package com.example.websitedating.services;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class SuggestionService {
    public Map<String, Object> suggestForUser(String userId) {
        // simple heuristic: return fixed spots, common times, and estimated cost range
        List<Map<String, String>> spots = List.of(
                Map.of("id","1","name","Sunset Rooftop Lounge","location","Downtown"),
                Map.of("id","2","name","The Cozy Bean Café","location","Midtown"),
                Map.of("id","3","name","Botanical Gardens Walk","location","Westside Park")
        );

        List<String> times = List.of("18:00", "19:00", "20:00");

        Map<String, Object> cost = Map.of("min",100000, "max",300000, "currency","VND");

        return Map.of("spots", spots, "times", times, "estimatedCost", cost);
    }
}
