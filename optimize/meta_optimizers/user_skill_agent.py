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
system_prompt = client.get_prompt("user-skill-agent:system-prompt")
user_prompt = client.get_prompt("user-skill-agent:user-prompt")

# Get the dataset to evaluate the prompt on
dataset = client.get_dataset(name="user-skill-agent-evaluation")
items = dataset.get_items()


# Define metrics
def answer_relevance(dataset_item, llm_output):
    context = [
        f"User role: {dataset_item['input']['user']['role']}",
        f"User current skills: {', '.join(dataset_item['input']['user']['skills'])}",
        f"User career goals: {', '.join(dataset_item['input']['user']['careerGoals'])}",
        f"Expected skill count: {dataset_item['expected']['skillCount']}",
        f"Skills to exclude (user already has): {', '.join(dataset_item['expected']['excludedSkills'])}",
        "Output format: JSON Lines — one JSON object per line with exactly these fields: name (string), priority (1-10), reasoning (string)",
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
    # Format prompts — replace mustache placeholders with actual dataset values
    system_text = system_prompt.format()
    user_text = user_prompt.format(
        userRole=item["input"]["user"]["role"],
        userSkills=", ".join(item["input"]["user"]["skills"]),
        userCareerGoals=", ".join(item["input"]["user"]["careerGoals"]),
    )

    prompt = ChatPrompt(
        system=system_text,
        user=user_text,
    )

    print(f"\nOptimizing for: {item['name']}")
    result = optimizer.optimize_prompt(
        prompt=prompt,
        dataset=dataset,
        metric=metric,
        n_samples=10,
    )
    result.display()
