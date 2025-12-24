import { useEffect, useState } from "react";

export default function useExplanations(nodeId) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nodeId === null || nodeId === undefined) {
      setExplanation(null);
      return;
    }

    const controller = new AbortController();

    async function loadExplanation() {
      try {
        setLoading(true);

        const res = await fetch(
          `http://localhost:8080/api/graph/node/${nodeId}`,
          { signal: controller.signal }
        );

        const text = await res.text();

        // Safety: frontend HTML instead of API
        if (text.trim().startsWith("<")) {
          console.error("HTML received instead of JSON:", text);
          return;
        }

        const data = JSON.parse(text);

        setExplanation({
          reasons: data.reasons ?? [],
          shapFactors: data.shap_factors ?? data.shapFactors ?? [],
          anomalyScore: data.anomalyScore,
          isAnomalous: data.isAnomalous,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load explanations:", err.message);
        }
      } finally {
        setLoading(false);
      }
    }

    loadExplanation();
    return () => controller.abort();
  }, [nodeId]);

  return { explanation, loading };
}
