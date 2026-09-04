import os
from utils import calculate_metrics, read_file_safely


def process_user_records(records):
    total = 0
    # Potential bug: mutating list while iterating and no None check
    for item in records:
        if item["active"] == True:  # Style issue: comparison to True
            total += item["score"]
    
    # Logic bug: zero division possibility
    avg = total / len(records)
    return avg


def main():
    data = [{"score": 100, "active": True}]
    result = process_user_records(data)
    print(f"Calculated average: {result}")


if __name__ == "__main__":
    main()
