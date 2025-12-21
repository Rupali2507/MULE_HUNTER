"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { ZoomIn, ZoomOut, Maximize, Search } from "lucide-react";

interface GraphNode {
  id: number | string;
  node_id: number;
  is_anomalous: number;
  anomaly_score: number;
  x?: number;
  y?: number;
  z?: number;
  [key: string]: any;
}

interface GraphLink {
  source: any;
  target: any;
  amount: number;
  [key: string]: any;
}

interface FraudGraphProps {
  onNodeSelect: (node: any) => void;
  selectedNode: any; 
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
}

export default function FraudGraph3D({ onNodeSelect, selectedNode, graphData }: FraudGraphProps) {
  const fgRef = useRef<any>(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState(false);
  const [searchId, setSearchId] = useState("");

  // Physics tuning
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-450); 
      fgRef.current.d3Force("link").distance(200);
      fgRef.current.d3Force("center").strength(0.15);
    }
  }, [graphData]);

  const getLinkId = (node: any) => (typeof node === "object" ? node.id : node);

  const visibleData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    if (!showOnlyFraud) return graphData;

    const fraudNodes = graphData.nodes.filter((n: GraphNode) => n.is_anomalous === 1);
    const fraudIds = new Set(fraudNodes.map((n: GraphNode) => n.id));
    
    return {
      nodes: fraudNodes,
      links: graphData.links.filter((l: GraphLink) => {
        const srcId = getLinkId(l.source);
        const tgtId = getLinkId(l.target);
        return fraudIds.has(srcId) && fraudIds.has(tgtId);
      })
    };
  }, [graphData, showOnlyFraud]);

  const flyToNode = (node: GraphNode) => {
    const distance = 220;
    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const nz = node.z ?? 0;
    const distRatio = 1 + distance / Math.hypot(nx, ny, nz);

    fgRef.current.cameraPosition(
      { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio },
      node, 
      2000 
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId || !fgRef.current) return;

    const node = visibleData.nodes.find(
      (n: any) => 
        n.node_id?.toString() === searchId.trim() || 
        n.id?.toString() === searchId.trim()
    );

    if (node) {
      onNodeSelect(node);
      flyToNode(node);
    } else {
      alert("Node ID not found.");
    }
  };

  const handleZoomIn = () => {
    const cam = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition({ z: cam.z * 0.6 }, null, 500);
  };

  const handleZoomOut = () => {
    const cam = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition({ z: cam.z * 1.4 }, null, 500);
  };

  const handleResetZoom = () => fgRef.current.zoomToFit(800, 150);

  return (
    <div className="relative h-full w-full bg-[#010409]">
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-4 pointer-events-auto">
        <div className="p-5 bg-black/80 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl">
          <h1 className="text-white font-bold tracking-tighter text-lg uppercase flex items-center gap-2">
            Network Analysis 
            <span className="animate-pulse h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          </h1>
          
          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center bg-zinc-900 border border-white/20 rounded-lg overflow-hidden focus-within:border-blue-500/50 transition-all">
              <input 
                type="text" 
                placeholder="Search numeric ID..." 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="bg-transparent px-3 py-2 text-xs text-white outline-none w-44 font-mono"
              />
              <button type="submit" className="px-3 text-zinc-400 hover:text-white border-l border-white/10">
                <Search size={14} />
              </button>
            </div>
            <span className="text-[9px] text-zinc-500 ml-1 italic font-mono uppercase tracking-widest">Input Format: 238</span>
          </form>

          <label className="flex items-center gap-3 mt-4 cursor-pointer text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all">
            <input 
              type="checkbox" 
              checked={showOnlyFraud} 
              onChange={e => setShowOnlyFraud(e.target.checked)} 
              className="w-3.5 h-3.5 rounded-full accent-red-600"
            />
            Isolate Anomalies
          </label>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
        <button onClick={handleZoomIn} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-300 hover:text-white transition-all"><ZoomIn size={20} /></button>
        <button onClick={handleZoomOut} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-300 hover:text-white transition-all"><ZoomOut size={20} /></button>
        <button onClick={handleResetZoom} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-300 hover:text-white transition-all"><Maximize size={20} /></button>
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={visibleData}
        backgroundColor="#010409"
        showNavInfo={false}
        
        nodeLabel={(node: any) => `
          <div style="background: rgba(0,0,0,0.85); color: white; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); font-family: monospace; font-size: 12px;">
            <strong style="color: ${node.is_anomalous ? '#ff4d4d' : '#4dff88'}">
              ID: ${node.node_id || node.id}
            </strong><br/>
            Score: ${node.anomaly_score.toFixed(4)}<br/>
            Status: ${node.is_anomalous ? 'ANOMALOUS' : 'VERIFIED'}
          </div>
        `}

        nodeThreeObject={(node: any) => {
          const isSelected = selectedNode === node.id;
          const geometry = new THREE.SphereGeometry(isSelected ? 10 : 5.5, 24, 24);
          const material = new THREE.MeshPhongMaterial({
            color: node.is_anomalous === 1 ? "#ff0000" : "#00ff66",
            transparent: true,
            opacity: isSelected ? 0.95 : 0.65, 
            shininess: 100,
            emissive: node.is_anomalous === 1 ? "#440000" : "#003311",
            emissiveIntensity: isSelected ? 2.5 : 0.5
          });
          return new THREE.Mesh(geometry, material) as any;
        }}

        linkWidth={(l: any) => {
           const srcId = getLinkId(l.source);
           const tgtId = getLinkId(l.target);
           const isRel = selectedNode && (srcId === selectedNode || tgtId === selectedNode);
           return isRel ? 5.5 : 1.2; 
        }}
        linkColor={(l: any) => {
          const srcId = getLinkId(l.source);
          const tgtId = getLinkId(l.target);
          const isRel = selectedNode && (srcId === selectedNode || tgtId === selectedNode);
          
          if (isRel) {
            const selNodeObj = visibleData.nodes.find(n => n.id === selectedNode);
            return selNodeObj?.is_anomalous ? "rgba(255, 30, 30, 0.5)" : "rgba(30, 255, 100, 1.0)";
          }
          
          return "rgba(255, 255, 255, 0.2)";
        }}

        linkDirectionalParticles={1.2}
        linkDirectionalParticleWidth={1.5} 
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleColor={() => "#ffffff"}
        
        onNodeClick={(node: any) => {
          onNodeSelect(node);
          flyToNode(node);
        }}
      />

      <div className="absolute bottom-4 w-full text-center text-[9px] text-zinc-600 uppercase tracking-[0.2em] pointer-events-none font-mono">
        Neural Mesh Engine Active • Latency 2ms
      </div>
    </div>
  );
}