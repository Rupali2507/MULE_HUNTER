import Image from "next/image";

const Navbar = () => {
  return (
    <nav className="w-full flex items-center justify-between px-4 md:px-8 py-4 bg-[#1A1A1A] border-b border-gray-800">
      
      <div className="flex items-center shrink-0">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={150}
          height={40}
          className="object-contain" 
          priority
        />
      </div>

      <div className="hidden md:flex gap-8 text-gray-400 text-sm font-medium">
        <a href="#" className="hover:text-[#CAFF33] transition-colors">Home</a>
        <a href="#" className="hover:text-[#CAFF33] transition-colors">Network</a>
        <a href="#" className="hover:text-[#CAFF33] transition-colors">Alerts</a>
        <a href="#" className="hover:text-[#CAFF33] transition-colors">Stats</a>
      </div>

      <div className="flex items-center">
        <button className="bg-[#CAFF33] px-6 py-2 rounded-full text-black font-bold text-sm hover:bg-[#b8e62e] transition-all">
          Login
        </button>
      </div>

    </nav>
  );
};

export default Navbar;