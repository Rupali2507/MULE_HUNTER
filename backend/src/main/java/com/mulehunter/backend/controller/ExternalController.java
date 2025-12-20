// package com.mulehunter.backend.controller;

// import org.springframework.web.bind.annotation.GetMapping;
// import org.springframework.web.bind.annotation.RestController;
// import org.springframework.web.reactive.function.client.WebClient;

// import reactor.core.publisher.Mono;

// @RestController
// public class ExternalController {

//     private final WebClient webClient;

//     public ExternalController(WebClient.Builder builder) {
//         this.webClient = builder.build();
//     }

//     @GetMapping("/external")
//     public Mono<String> callExternal() {
//         System.out.println("Before call: " + Thread.currentThread().getName());

//         return webClient.get()
//                 .uri("https://httpbin.org/delay/1")
//                 .retrieve()
//                 .bodyToMono(String.class)
//                 .map(response -> {
//                     System.out.println("After call: " + Thread.currentThread().getName());
//                     return response;
//                 });
//     }
// }
