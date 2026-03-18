package com.mulehunter.backend.model;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "nodes_enriched")
public class NodeEnriched {

    @Id
    private String id;

    private Long nodeId;

    private long inDegree;
    private long outDegree;

    private double totalIncoming;
    private double totalOutgoing;

    private double riskRatio;
    private long txVelocity;

    private long accountAgeDays;
    private double balance;

    // ✅ ADD THIS (CRITICAL)
    private String isFraud; // "1" or "0"

    private Instant updatedAt;

    public NodeEnriched() {}

    // ─── Getters & Setters ─────────────────

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getNodeId() {
        return nodeId;
    }

    public void setNodeId(Long nodeId) {
        this.nodeId = nodeId;
    }

    public long getInDegree() {
        return inDegree;
    }

    public void setInDegree(long inDegree) {
        this.inDegree = inDegree;
    }

    public long getOutDegree() {
        return outDegree;
    }

    public void setOutDegree(long outDegree) {
        this.outDegree = outDegree;
    }

    public double getTotalIncoming() {
        return totalIncoming;
    }

    public void setTotalIncoming(double totalIncoming) {
        this.totalIncoming = totalIncoming;
    }

    public double getTotalOutgoing() {
        return totalOutgoing;
    }

    public void setTotalOutgoing(double totalOutgoing) {
        this.totalOutgoing = totalOutgoing;
    }

    public double getRiskRatio() {
        return riskRatio;
    }

    public void setRiskRatio(double riskRatio) {
        this.riskRatio = riskRatio;
    }

    public long getTxVelocity() {
        return txVelocity;
    }

    public void setTxVelocity(long txVelocity) {
        this.txVelocity = txVelocity;
    }

    public long getAccountAgeDays() {
        return accountAgeDays;
    }

    public void setAccountAgeDays(long accountAgeDays) {
        this.accountAgeDays = accountAgeDays;
    }

    public double getBalance() {
        return balance;
    }

    public void setBalance(double balance) {
        this.balance = balance;
    }

    // ✅ NEW GETTER/SETTER
    public String getIsFraud() {
        return isFraud;
    }

    public void setIsFraud(String isFraud) {
        this.isFraud = isFraud;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}