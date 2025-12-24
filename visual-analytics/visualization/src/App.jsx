import { useState } from "react";
import FraudGraph3D from "./components/FraudGraph3D";
import NodeInspector from "./components/NodeInspector";

function App() {
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Graph */}
      <div className="flex-1">
        <FraudGraph3D onNodeSelect={setSelectedNode} />
      </div>

      {/* Sidebar */}
      <NodeInspector
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default App;
