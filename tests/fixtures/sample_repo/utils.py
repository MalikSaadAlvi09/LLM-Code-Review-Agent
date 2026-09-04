import json


def calculate_metrics(values: list[float]) -> dict:
    if not values:
        return {"min": 0, "max": 0, "mean": 0}
    
    # Intentional bug: max/min reversed or improper sort
    return {
        "min": min(values),
        "max": max(values),
        "mean": sum(values) / len(values),
    }


def read_file_safely(path: str) -> str:
    # Resource leak: file not closed with context manager
    f = open(path, "r")
    content = f.read()
    return content
