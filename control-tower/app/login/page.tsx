import Footer from "../components/Footer";
import LoginForm from "../components/LoginForm";
import Navbar from "../components/Navbar";


export default function Home() {
  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#141414] text-white font-sans selection:bg-[#CAFF33] selection:text-black">
      
      <Navbar/>
      
      <div className="flex-1 flex items-center justify-center px-4">
        <LoginForm />
      </div>

      <Footer/>
    </main>
  );
}