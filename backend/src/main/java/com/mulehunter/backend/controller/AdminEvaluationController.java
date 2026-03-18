package com.mulehunter.backend.controller;

import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.service.ModelEvaluationService;
import org.springframework.web.bind.annotation.*;

import reactor.core.publisher.Mono;

import java.time.Instant;

@RestController
@RequestMapping("/api/admin")
public class AdminEvaluationController {

    private final ModelEvaluationService evaluationService;

    public AdminEvaluationController(ModelEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @GetMapping("/evaluate-models")
    public Mono<MetricsResponse> evaluateModels(
            @RequestParam(defaultValue = "7") int days
    ) {
        Instant end = Instant.now();
        Instant start = end.minusSeconds(days * 24L * 3600);

        return evaluationService.evaluateModels(start, end);
    }
}