package com.mulehunter.backend.DTO;

public record GraphNodeDTO(
    String nodeId,
    double anomalyScore,
    boolean isAnomalous,
    long volume
) {}

