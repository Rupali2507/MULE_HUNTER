import LoginForm from "../components/LoginForm";
import Navbar from "../components/Navbar";


export default function Home() {
  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#141414] text-white font-sans selection:bg-[#CAFF33] selection:text-black">
      
      <Navbar/>
      
      <div className="flex-1 flex items-center justify-center px-4">
        <LoginForm />
      </div>

      <footer className="bg-[#1A1A1A] py-4 border-t border-gray-800 text-center text-gray-500 text-[10px] md:text-xs">
        © 2025 MULE HUNTER. All Rights Reserved.
      </footer>
    </main>
  );
}