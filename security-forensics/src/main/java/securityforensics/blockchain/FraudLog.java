package securityforensics.blockchain;

public class FraudLog {
    public String txId;
    public String accountId;
    public double amount;
    public boolean fraud;
    public long timestamp;

    // ── New fields per architecture doc ──────────────────────────
    public double riskScore;
    public String decision;
    public String modelVersionEIF;
    public String modelVersionGNN;
    public String decisionHash;  // SHA256 of txId+riskScore+decision+timestamp

    // ── Original constructor (kept for backward compat) ──────────
    public FraudLog(String txId, String accountId, double amount, boolean fraud) {
        this.txId = txId;
        this.accountId = accountId;
        this.amount = amount;
        this.fraud = fraud;
        this.timestamp = System.currentTimeMillis();
        this.riskScore = 0;
        this.decision = fraud ? "BLOCK" : "APPROVE";
        this.modelVersionEIF = "unknown";
        this.modelVersionGNN = "unknown";
        this.decisionHash = MerkleTree.sha256(txId + riskScore + decision + timestamp);
    }

    // ── Full constructor per architecture doc ─────────────────────
    public FraudLog(String txId, String accountId, double amount,
                    double riskScore, String decision,
                    String modelVersionEIF, String modelVersionGNN) {
        this.txId = txId;
        this.accountId = accountId;
        this.amount = amount;
        this.fraud = decision.equals("BLOCK");
        this.timestamp = System.currentTimeMillis();
        this.riskScore = riskScore;
        this.decision = decision;
        this.modelVersionEIF = modelVersionEIF;
        this.modelVersionGNN = modelVersionGNN;
        this.decisionHash = MerkleTree.sha256(txId + riskScore + decision + timestamp);
    }

    public String serialize() {
        return txId + accountId + riskScore + decision + timestamp;
    }
}