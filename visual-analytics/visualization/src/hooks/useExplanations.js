import { useEffect, useState } from "react";

export default function useExplanations() {
  const [explanations, setExplanations] = useState({});

  useEffect(() => {
    fetch("/fraud_explanations.json")
      .then((res) => res.json())
      .then((data) => {
        const map = {};
        data.forEach((item) => {
          map[item.node_id] = {
            reasons: item.reasons,
          };
        });
        setExplanations(map);
      })
      .catch((err) => {
        console.error("Failed to load explanations", err);
      });
  }, []);

  return explanations;
}
