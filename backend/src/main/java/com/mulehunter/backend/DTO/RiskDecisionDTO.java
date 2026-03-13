package com.mulehunter.backend.DTO;

import java.util.List;
import java.util.Map;

public class RiskDecisionDTO {

    private String transactionId;
    private String decision;
    private double riskScore;
    private String explanation;
    private boolean highConfidence;

    private Map<String, Double> components;

    // NEW
    private Map<String, Double> eifTopFactors;
    private String eifExplanation;
    private Double gnnConfidence;
    private List<String> fraudSignals;

    private RiskDecisionDTO() {}

    public String getTransactionId() { return transactionId; }
    public String getDecision() { return decision; }
    public double getRiskScore() { return riskScore; }
    public String getExplanation() { return explanation; }
    public boolean isHighConfidence(){ return highConfidence; }
    public Map<String, Double> getComponents() { return components; }

    public Map<String, Double> getEifTopFactors() { return eifTopFactors; }
    public String getEifExplanation() { return eifExplanation; }
    public Double getGnnConfidence() { return gnnConfidence; }
    public List<String> getFraudSignals() {return fraudSignals;}

    public static Builder builder() { return new Builder(); }

    public static class Builder {

        private final RiskDecisionDTO dto = new RiskDecisionDTO();

        public Builder transactionId(String v){ dto.transactionId = v; return this; }
        public Builder decision(String v){ dto.decision = v; return this; }
        public Builder riskScore(double v){ dto.riskScore = v; return this; }
        public Builder explanation(String v){ dto.explanation = v; return this; }
        public Builder highConfidence(boolean v){ dto.highConfidence = v; return this; }
        public Builder components(Map<String, Double> v){ dto.components = v; return this; }

        // NEW
        public Builder eifTopFactors(Map<String, Double> v){
            dto.eifTopFactors = v;
            return this;
        }

        public Builder eifExplanation(String v){
            dto.eifExplanation = v;
            return this;
        }

        public Builder gnnConfidence(Double v){
            dto.gnnConfidence = v;
            return this;
        }
        public Builder fraudSignals(List<String> v) {
            dto.fraudSignals = v;
            return this;
        }

        public RiskDecisionDTO build(){ return dto; }
    }
}