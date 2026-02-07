# Configure the SDK
import json
import os
from dotenv import load_dotenv
import opik
from opik_optimizer import (
    ChatPrompt,
    MetaPromptOptimizer,
    MultiMetricObjective,
)
from opik.evaluation.metrics import AnswerRelevance
from opik_optimizer.metrics import TotalSpanCost, SpanDuration

# Load environment variables
load_dotenv()

# Load prompts and dataset from Opik
client = opik.Opik()
system_prompt = client.get_prompt("skill-resource-retriever-agent:system-prompt")

# Get the dataset to evaluate the prompt on
dataset = client.get_dataset(name="skill-resource-retriever-evaluation")
items = dataset.get_items()

# Format system prompt — no mustache placeholders
system_text = system_prompt.format()


# Define metrics
def answer_relevance(dataset_item, llm_output):
    inp = dataset_item["input"]
    expected = dataset_item.get("expected", {})
    context = [
        f"User role: {inp['user']['role']}",
        f"User current skills: {', '.join(inp['user']['skills'])}",
        f"User career goals: {', '.join(inp['user']['careerGoals'])}",
        f"Goal: {inp['goal']['name']}",
        f"Goal reasoning: {inp['goal']['reasoning']}",
        f"Expected minimum resources: {expected.get('minResourceCount', 'N/A')}",
        f"Expected providers: {', '.join(expected.get('expectedProviders', []))}",
        "Output format: Array of learning resources with: title, description, provider, resourceType, learningObjectives, sections",
    ]
    metric = AnswerRelevance()
    return metric.score(
        input=json.dumps(dataset_item["input"]),
        output=llm_output,
        context=context,
    )


def cost_in_cents(dataset_item, llm_output, task_span):
    cost_metric = TotalSpanCost()
    result = cost_metric.score(task_span=task_span)
    return result.value * 100


def duration_seconds(dataset_item, llm_output, task_span):
    duration_metric = SpanDuration()
    result = duration_metric.score(task_span=task_span)
    return result.value


metric = MultiMetricObjective(
    weights=[1.0, -0.25, -0.25],
    metrics=[answer_relevance, cost_in_cents, duration_seconds],
    name="relevance_cost_duration",
)


# Run the optimization for each dataset item
optimizer = MetaPromptOptimizer(
    model="openai/gpt-4o-mini",
    prompts_per_round=4,
    n_threads=8,
    enable_context=True,
    model_parameters={"temperature": 0.0},
    seed=42,
)

for item in items:
    user_input = json.dumps(
        {
            "user": {
                "role": item["input"]["user"]["role"],
                "skills": item["input"]["user"]["skills"],
                "careerGoals": item["input"]["user"]["careerGoals"],
            },
            "goal": {
                "name": item["input"]["goal"]["name"],
                "reasoning": item["input"]["goal"]["reasoning"],
            },
        }
    )

    prompt = ChatPrompt(
        system=system_text,
        user=user_input,
    )

    print(f"\nOptimizing for: {item['name']}")
    result = optimizer.optimize_prompt(
        prompt=prompt,
        dataset=dataset,
        metric=metric,
        n_samples=10,
    )
    result.display()
