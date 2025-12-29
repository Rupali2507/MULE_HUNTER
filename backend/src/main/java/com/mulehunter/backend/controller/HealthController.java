@RestController
@RequestMapping("/api/health")
public class HealthController {
    
    private final WebClient aiWebClient;
    
    public HealthController(@Value("${ai.service.url:http://localhost:8001}") String aiServiceUrl) {
        this.aiWebClient = WebClient.builder().baseUrl(aiServiceUrl).build();
    }
    
    @GetMapping("/ai")
    public Mono<JsonNode> getAiHealth() {
        return aiWebClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorResume(e -> {
                    System.err.println("❌ AI Health Check Failed: " + e.getMessage());
                    return Mono.just(createErrorResponse());
                });
    }
    
    private JsonNode createErrorResponse() {
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode node = mapper.createObjectNode();
        node.put("status", "UNAVAILABLE");
        node.put("model_loaded", false);
        node.put("nodes_count", 0);
        node.put("version", "Unknown");
        return node;
    }
}