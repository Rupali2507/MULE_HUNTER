import { useState } from "react";
import FraudGraph3D from "./components/FraudGraph3D";
import NodeInspector from "./components/NodeInspector";
import useExplanations from "./hooks/useExplanations";

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const explanations = useExplanations();

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Graph */}
      <div className="flex-1">
        <FraudGraph3D onNodeSelect={setSelectedNode} />
      </div>

      {/* Sidebar */}
      <NodeInspector
        node={selectedNode}
        explanations={explanations}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default App;
