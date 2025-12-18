import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
}) {
  const fgRef = useRef();
  const containRef = useRef();
  const [rawGraph, setRawGraph] = useState(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);

  useEffect(() => {
    fetch("/nodes_viz.json")
      .then((res) => res.json())
      .then((data) => setRawGraph(data));
  }, []);

  const visibleGraph = useMemo(() => {
    if (!rawGraph) return null;
    if (!showOnlyFraud) return rawGraph;

    const fraudIds = new Set(
      rawGraph.nodes.filter((n) => n.is_anomalous === 1).map((n) => n.id)
    );

    return {
      nodes: rawGraph.nodes.filter((n) => fraudIds.has(n.id)),
      links: rawGraph.links.filter((l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return fraudIds.has(src) && fraudIds.has(tgt);
      }),
    };
  }, [rawGraph, showOnlyFraud]);

  useEffect(() => {
    if (!containRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fgRef.current || !rawGraph) return;

    fgRef.current.cameraPosition(
      { x: 0, y: 0, z: 900 },
      { x: 0, y: 0, z: 0 },
      0
    );
  }, [rawGraph]);

  useEffect(() => {
    if (!selectedNode || !fgRef.current) return;

    fgRef.current.cameraPosition(
      {
        x: selectedNode.x * 1.3,
        y: selectedNode.y * 1.3,
        z: selectedNode.z * 1.3 + 120,
      },
      selectedNode,
      1500
    );
  }, [selectedNode]);

  if (!visibleGraph) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Loading Fraud Network…
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-linear-to-br from-black via-slate-900 to-black">
      <div className="absolute top-6 left-6 z-10 max-w-md">
        <h1 className="text-xl font-semibold text-white">
          Fraud Transaction Network (3D)
        </h1>
        <p className="text-sm text-gray-400">
          Red nodes indicate anomalous / high-risk accounts detected via EIF
        </p>
      </div>

      <div className="absolute top-24 left-6 z-10 rounded-xl bg-black/70 p-4 text-sm text-gray-200 backdrop-blur">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFraud}
            onChange={(e) => setShowOnlyFraud(e.target.checked)}
            className="accent-red-500"
          />
          Show only fraud nodes
        </label>

        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Fraud / Anomalous
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            Normal
          </div>
          <div className="flex items-center gap-2">
            <span className="h-[0.5px] w-6 bg-gray-700" />
            Transaction
          </div>
        </div>
      </div>

      <div ref={containRef} className="h-full w-full">
        <ForceGraph3D
          ref={fgRef}
          graphData={visibleGraph}
          onNodeClick={(node) => {
            onNodeSelect(node);
            setActiveNodeId(node.id);
          }}
          backgroundColor="rgba(0,0,0,0)"
          enableNodeDrag={false}
          warmupTicks={120}
          cooldownTicks={0}
          nodeThreeObject={(node) => {
            const isSelected = selectedNode?.id === node.id;
            const isAlerted = alertedNodeId === node.id;
            const geometry = new THREE.SphereGeometry(
              isAlerted ? 7 : isSelected ? 6 : 3,
              18,
              18
            );

            const material = new THREE.MeshStandardMaterial({
              color: node.color,
              emissive: isSelected ? node.color : "#000000",
              emissiveIntensity: isSelected ? 0.9 : 0,
            });

            return new THREE.Mesh(geometry, material);
          }}
          nodeLabel={(n) =>
            `Account ${n.id}
Anomaly Score: ${n.height.toFixed(2)}
Status: ${n.is_anomalous ? "Fraud" : "Normal"}`
          }
          linkColor={(link) => {
            if (!activeNodeId) return "rgba(180,180,180,0.35)";

            const isConnected =
              link.source.id === activeNodeId ||
              link.target.id === activeNodeId;

            if (!isConnected) return "rgba(180,180,180,0.15)";

            // Only fraud nodes turn edges red
            const selectedNode = visibleGraph.nodes.find(
              (n) => n.id === activeNodeId
            );

            if (selectedNode?.is_anomalous) return "rgba(255,80,80,0.9)";

            return "rgba(180,180,180,0.35)";
          }}
          linkWidth={(l) => {
            if (!selectedNode) return Math.min(1.2, Math.log(l.amount + 1));
            const src = l.source.id ?? l.source;
            const tgt = l.target.id ?? l.target;
            return src === selectedNode.id || tgt === selectedNode.id
              ? 2.5
              : 0.2;
          }}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleSpeed={0.005}
        />
      </div>

      <div className="absolute bottom-4 w-full text-center text-xs text-white">
        Left-click rotate · Scroll zoom · Right-click pan
      </div>
      {alertedNodeId && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute left-1/2 top-1/2 h-32 w-32 
      animate-ping rounded-full border-2 border-red-500 opacity-75"
          />
        </div>
      )}
    </div>
  );
}
