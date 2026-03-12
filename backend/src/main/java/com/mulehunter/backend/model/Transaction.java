package com.mulehunter.backend.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.index.Indexed;

@Document(collection = "newtransactions")
public class Transaction {

    @Id
    private String id;

    @Indexed(unique=true)
    private String transactionId;

    private String sourceAccount;
    private String targetAccount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private Instant timestamp;
    private String status;

    private boolean suspectedFraud;
    private Double riskScore;
    private String verdict;

    // ================= AI COMPONENT SCORES =================

    private Double gnnScore;
    private Double behaviorScore;
    private Double velocityScore;
    private Double burstScore;
    private Double graphScore;

    // ================= GRAPH / AI =================
    private int outDegree;
    private Double riskRatio;
    private Integer populationSize;

    private List<String> linkedAccounts = new ArrayList<>();

    private String unsupervisedModelName;
    private Double unsupervisedScore;

    // ================= JA3 =================
    private Boolean ja3Detected;
    private Double ja3Risk;
    private Integer ja3Velocity;
    private Integer ja3Fanout;

    private String deviceHash;
    private String ipAddress;

    private Integer ja3ReuseCount;
    private Integer deviceReuseCount;
    private Integer ipReuseCount;

    private Boolean isNewDevice;
    private Boolean isNewJa3;

    public Transaction() {}

    public static Transaction from(TransactionRequest request) {

        Transaction tx = new Transaction();

        tx.transactionId = request.getTransactionId();
        tx.sourceAccount = request.getSourceAccount();
        tx.targetAccount = request.getTargetAccount();
        tx.amount = request.getAmount() == null ? BigDecimal.ZERO : request.getAmount();

        tx.timestamp = request.getTimestamp();
        tx.status = "PENDING_RISK";

        tx.suspectedFraud = false;
        tx.riskScore = 0.0;
        tx.verdict = "PENDING";

        return tx;
    }

    // ================= GETTERS / SETTERS =================

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }

    public String getSourceAccount() { return sourceAccount; }
    public void setSourceAccount(String sourceAccount) { this.sourceAccount = sourceAccount; }

    public String getTargetAccount() { return targetAccount; }
    public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isSuspectedFraud() { return suspectedFraud; }
    public void setSuspectedFraud(boolean suspectedFraud) { this.suspectedFraud = suspectedFraud; }

    public Double getRiskScore() { return riskScore; }
    public void setRiskScore(Double riskScore) { this.riskScore = riskScore; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public int getOutDegree() { return outDegree; }
    public void setOutDegree(int outDegree) { this.outDegree = outDegree; }

    public Double getRiskRatio() { return riskRatio; }
    public void setRiskRatio(Double riskRatio) { this.riskRatio = riskRatio; }

    public Integer getPopulationSize() { return populationSize; }
    public void setPopulationSize(Integer populationSize) { this.populationSize = populationSize; }

    public List<String> getLinkedAccounts() { return linkedAccounts; }
    public void setLinkedAccounts(List<String> linkedAccounts) { this.linkedAccounts = linkedAccounts; }

    public String getUnsupervisedModelName() { return unsupervisedModelName; }
    public void setUnsupervisedModelName(String unsupervisedModelName) {
        this.unsupervisedModelName = unsupervisedModelName;
    }

    public Double getUnsupervisedScore() { return unsupervisedScore; }
    public void setUnsupervisedScore(double unsupervisedScore) {
        this.unsupervisedScore = unsupervisedScore;
    }

    // ================= JA3 =================

    public Boolean getJa3Detected() { return ja3Detected; }
    public void setJa3Detected(Boolean ja3Detected) { this.ja3Detected = ja3Detected; }

    public Double getJa3Risk() { return ja3Risk; }
    public void setJa3Risk(Double ja3Risk) { this.ja3Risk = ja3Risk; }

    public Integer getJa3Velocity() { return ja3Velocity; }
    public void setJa3Velocity(Integer ja3Velocity) { this.ja3Velocity = ja3Velocity; }

    public Integer getJa3Fanout() { return ja3Fanout; }
    public void setJa3Fanout(Integer ja3Fanout) { this.ja3Fanout = ja3Fanout; }

    public String getDeviceHash() {return deviceHash;}

    public void setDeviceHash(String deviceHash) { this.deviceHash = deviceHash;}


public String getIpAddress() {
    return ipAddress;
}

public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
}

// ja3ReuseCount
public Integer getJa3ReuseCount() {
    return ja3ReuseCount;
}

public void setJa3ReuseCount(Integer ja3ReuseCount) {
    this.ja3ReuseCount = ja3ReuseCount;
}

// deviceReuseCount
public Integer getDeviceReuseCount() {
    return deviceReuseCount;
}

public void setDeviceReuseCount(Integer deviceReuseCount) {
    this.deviceReuseCount = deviceReuseCount;
}

// ipReuseCount
public Integer getIpReuseCount() {
    return ipReuseCount;
}

public void setIpReuseCount(Integer ipReuseCount) {
    this.ipReuseCount = ipReuseCount;
}

// isNewDevice
public Boolean getIsNewDevice() {
    return isNewDevice;
}

public void setIsNewDevice(Boolean isNewDevice) {
    this.isNewDevice = isNewDevice;
}

// isNewJa3
public Boolean getIsNewJa3() {
    return isNewJa3;
}

public void setIsNewJa3(Boolean isNewJa3) {
    this.isNewJa3 = isNewJa3;
}


public Double getGnnScore() { return gnnScore; }
public void setGnnScore(Double gnnScore) { this.gnnScore = gnnScore; }

public Double getBehaviorScore() { return behaviorScore; }
public void setBehaviorScore(Double behaviorScore) { this.behaviorScore = behaviorScore; }

public Double getVelocityScore() { return velocityScore; }
public void setVelocityScore(Double velocityScore) { this.velocityScore = velocityScore; }

public Double getBurstScore() { return burstScore; }
public void setBurstScore(Double burstScore) { this.burstScore = burstScore; }

public Double getGraphScore() { return graphScore; }
public void setGraphScore(Double graphScore) { this.graphScore = graphScore; }

}