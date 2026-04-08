import PaymentSection from "../components/PaymentSection";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export const metadata = {
  title: "Live Demo — MuleHunter",
  description: "Real-time UPI payment gateway with fraud detection",
};

export default function DemoPage() {
  return (<>
    <Navbar/>
    <main className="min-h-screen bg-[#0D0D0D] px-4 py-12 md:px-8">
        
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#CAFF33] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#CAFF33]" />
          </span>
          <span className="text-[#CAFF33] text-xs font-mono tracking-widest uppercase">
            Live System
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
          UPI Payment Gateway
          <span className="block text-[#CAFF33]">with Real-Time Fraud Detection</span>
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
          Every transaction runs through the full MuleHunter pipeline — GNN graph scoring,
          Extended Isolation Forest anomaly detection, JA3 fingerprinting, and behavioral
          analysis — before a verdict is returned in under 50ms.
        </p>

        {/* Pipeline chips */}
        <div className="flex flex-wrap gap-2 mt-5">
          {[
            { label: "GraphSAGE GNN", weight: "40%" },
            { label: "Isolation Forest", weight: "20%" },
            { label: "Behavior", weight: "25%" },
            { label: "Graph context", weight: "10%" },
            { label: "JA3", weight: "5%" },
          ].map(({ label, weight }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-xs font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#CAFF33]" />
              {label}
              <span className="text-gray-500">{weight}</span>
            </span>
          ))}
        </div>

        {/* Threshold legend */}
        <div className="flex gap-5 mt-5 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            &lt; 0.45 Approve
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            0.45 – 0.75 Review
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            ≥ 0.75 Block
          </span>
        </div>
      </div>

      {/* Payment form */}
      <div className="max-w-2xl mx-auto">
        <PaymentSection currentUserAccount="1553" />
      </div>

     
    </main>
     <Footer/>
    </>
  );
}