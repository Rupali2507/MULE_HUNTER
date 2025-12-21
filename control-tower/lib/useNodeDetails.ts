"use client"
import { useEffect, useState } from "react";

export function useNodeDetails(nodeId: number | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!nodeId) {
      setData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/node/${nodeId}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch node details:", err);
        setLoading(false);
      });
  }, [nodeId]);

  // Return an object so destructuring works in the Page component
  return { data, loading };
}