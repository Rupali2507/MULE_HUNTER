package com.mulehunter.backend.DTO;

public class MetricsResponse {

    public ModelMetrics combined;
    public ModelMetrics gnn;
    public ModelMetrics eif;

    public static class ModelMetrics {
        public double precision;
        public double recall;
        public double f1Score;
        public double accuracy;
    }
}