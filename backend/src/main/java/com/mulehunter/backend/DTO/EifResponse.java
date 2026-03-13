package com.mulehunter.backend.DTO;

import java.util.Map;

public class EifResponse {

    private String model;
    private String version;
    private double score;
    private double confidence;
    private Map<String, Double> topFactors;
    private String explanation;

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public Map<String, Double> getTopFactors() { return topFactors; }
    public void setTopFactors(Map<String, Double> topFactors) { this.topFactors = topFactors; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
}