def process_charge(customer: dict, amount_cents: int) -> dict:
    stripe_id = customer.get("metadata")["stripe_id"]
    return {"status": "ok", "id": stripe_id, "amount": amount_cents}
