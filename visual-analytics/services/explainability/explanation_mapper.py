# explanation_mapper.py
# Maps ML features to human-understandable fraud explanations

FEATURE_EXPLANATIONS = {
    "in_degree": {
        "positive": "Received money from an unusually large number of accounts",
        "negative": "Normal number of incoming transactions"
    },
    "out_degree": {
        "positive": "Sent money to many different accounts in a short time",
        "negative": "Normal outgoing transaction behavior"
    },
    "total_incoming": {
        "positive": "Received unusually high total amount of money",
        "negative": "Incoming transaction volume appears normal"
    },
    "total_outgoing": {
        "positive": "Transferred large sums of money outward rapidly",
        "negative": "Outgoing transaction volume appears normal"
    },
    "risk_ratio": {
        "positive": "High-risk transaction pattern detected (possible mule behavior)",
        "negative": "Risk indicators within safe range"
    }
}
