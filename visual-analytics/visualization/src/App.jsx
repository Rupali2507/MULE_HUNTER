import { useState } from "react";
import FraudGraph3D from "./components/FraudGraph3D";
import NodeInspector from "./components/NodeInspector";
import useExplanations from "./hooks/useExplanations";

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [alertedNodeId, setAlertedNodeId] = useState(null);
  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    setAlertedNodeId(node.id);

    // clear alert after animation
    setTimeout(() => setAlertedNodeId(null), 3000);
  };
  const explanations = useExplanations();

  return (
    <div className="flex h-screen bg-black text-white">
      {/* 3D Graph */}
      <div className="flex-1">
        <FraudGraph3D
          selectedNode={selectedNode}
          alertedNodeId={alertedNodeId}
          onNodeSelect={handleNodeSelect}
        />
      </div>

      {/* Inspector Panel */}
      <div className="w-96 border-l border-gray-800">
        <NodeInspector node={selectedNode} explanations={explanations} />
      </div>
    </div>
  );
}

export default App;
