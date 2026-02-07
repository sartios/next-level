# Configure the SDK
import json
import os
from dotenv import load_dotenv
import opik
from opik_optimizer import (
    ChatPrompt,
    MetaPromptOptimizer,
)
from opik.evaluation.metrics import AnswerRelevance

# Load environment variables
load_dotenv()

# Load prompts and dataset from Opik
client = opik.Opik()
system_prompt = client.get_prompt("challenge-generator-agent:system-prompt")
user_prompt = client.get_prompt("challenge-generator-agent:user-prompt")

# Get the dataset to evaluate the prompt on
dataset = client.get_dataset(name="challenge-generator-evaluation")
items = [dataset.get_items()[0]]

DIFFICULTY_DESCRIPTIONS = {
    "easy": "beginner-friendly questions that test basic recall and understanding",
    "medium": "intermediate questions that require applying knowledge to scenarios",
    "hard": "advanced questions that require deep understanding and critical thinking",
}


# Define metrics
def answer_relevance(dataset_item, llm_output):
    inp = dataset_item["input"]
    challenge = inp["challenge"]
    context = [
        f"User role: {inp['user']['role']}",
        f"User skills: {', '.join(inp['user']['skills'])}",
        f"User career goals: {', '.join(inp['user']['careerGoals'])}",
        f"Learning goal: {inp['goal']['name']}",
        f"Goal reasoning: {inp['goal']['reasoning']}",
        f"Resource: {inp['resource']['title']}",
        f"Resource provider: {inp['resource']['provider']}",
        f"Section: {challenge['sectionTitle']}",
        f"Difficulty: {challenge['difficulty']}",
        f"Expected question count: {challenge['totalQuestions']}",
        f"Topics: {', '.join(challenge.get('sectionTopics') or [])}",
        f"Output format: Array of question objects with fields: questionNumber, question, options (A/B/C/D), correctAnswer, explanation, hint",
    ]
    metric = AnswerRelevance()
    return metric.score(
        input=json.dumps(inp),
        context=context,
        output=llm_output,
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
    difficulty = item["input"]["challenge"]["difficulty"]

    # Format prompts — replace mustache placeholders with actual dataset values
    system_text = system_prompt.format(
        questionsPerChallenge=item["input"]["challenge"]["totalQuestions"],
        difficultyDescription=DIFFICULTY_DESCRIPTIONS[difficulty],
        sectionTitle=item["input"]["challenge"]["sectionTitle"],
        difficultyUpper=difficulty.upper(),
    )
    user_text = user_prompt.format(
        questionsPerChallenge=item["input"]["challenge"]["totalQuestions"],
        difficulty=difficulty,
        userRole=item["input"]["user"]["role"],
        userSkills=", ".join(item["input"]["user"]["skills"]),
        userCareerGoals=", ".join(item["input"]["user"]["careerGoals"]),
        goalName=item["input"]["goal"]["name"],
        goalReasoning=item["input"]["goal"]["reasoning"],
        resourceTitle=item["input"]["resource"]["title"],
        resourceProvider=item["input"]["resource"]["provider"],
        resourceType=item["input"]["resource"]["resourceType"],
        resourceDescription=item["input"]["resource"]["description"],
        learningObjectives=", ".join(item["input"]["resource"]["learningObjectives"]),
        sectionTitle=item["input"]["challenge"]["sectionTitle"],
        sectionTopics=", ".join(item["input"]["challenge"]["sectionTopics"] or []),
    )

    prompt = ChatPrompt(
        system=system_text,
        user=user_text,
    )

    print(f"\nOptimizing for: {item['name']}")
    result = optimizer.optimize_prompt(
        prompt=prompt,
        dataset=dataset,
        metric=answer_relevance,
        n_samples=10,
    )
    result.display()
