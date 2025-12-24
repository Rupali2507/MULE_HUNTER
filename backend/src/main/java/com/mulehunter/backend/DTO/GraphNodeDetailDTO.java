package com.mulehunter.backend.DTO;



import java.util.List;
import java.util.Map;

public record GraphNodeDetailDTO(
        String nodeId,
        double anomalyScore,
        boolean isAnomalous,
        List<String> reasons,
        List<Map<String, Object>> shapFactors
) {}
