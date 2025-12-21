"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import NodeInspector from "../components/NodeInspector";
import { useNodeDetails } from "@/lib/useNodeDetails";

const FraudGraph3D = dynamic(() => import("../components/FraudGraph3D"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-black text-lime-400 font-mono">
      INITIALIZING 3D ENGINE...
    </div>
  ),
});

export default function NetworkPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isGraphLoading, setIsGraphLoading] = useState(true);
  
  const { data: nodeDetails, loading: isDetailsLoading } = useNodeDetails(selectedNodeId);

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        setIsGraphLoading(false);
      })
      .catch((err) => console.error("Error loading graph:", err));
  }, []);

  return (
    <main className="flex h-screen w-full bg-black overflow-hidden text-white">
      <div className="flex-1 relative">
        {isGraphLoading ? (
          <div className="h-full w-full flex items-center justify-center font-mono text-zinc-500">
            CONNECTING TO NEURAL MESH...
          </div>
        ) : (
          <FraudGraph3D
            graphData={graphData}
            onNodeSelect={(node: any) => setSelectedNodeId(node.id)} 
            selectedNode={selectedNodeId}
          />
        )}
      </div>

      <div className="w-96 relative z-50">
        {selectedNodeId && (
            <NodeInspector 
              node={nodeDetails} 
              loading={isDetailsLoading}
              onClose={() => setSelectedNodeId(null)} 
            />
        )}
        
        {!selectedNodeId && (
          <div className="h-full border-l border-white/10 bg-[#0a0a0a] p-10 text-center text-gray-500 font-mono text-sm flex items-center">
            SELECT A NODE TO VIEW NETWORK FORENSICS
          </div>
        )}
      </div>
    </main>
  );
}