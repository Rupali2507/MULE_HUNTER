"use client"
import { useState } from 'react';

const LoginForm = () => {
  const [role, setRole] = useState('Admin');
  const roles = ['Admin', 'Investigator', 'Viewer'];

  return (
    <div className="w-full max-w-lg md:max-w-xl bg-[#1C1C1C] p-6 md:p-8 rounded-2xl border border-gray-800 shadow-2xl text-center">
      <h1 className="text-[#CAFF33] text-2xl md:text-3xl font-semibold mb-1">Login</h1>
      <p className="text-gray-400 text-xs md:text-sm mb-6">Select access level and enter credentials.</p>
      
      <form className="space-y-5">
        <div className="space-y-2">
          <div className="flex p-1 bg-[#141414] rounded-lg border border-gray-800 gap-1">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                  role === r ? "bg-[#262626] text-[#CAFF33] border border-gray-700" : "text-gray-500"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <input 
            type="email" 
            placeholder="Email Address" 
            className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-white text-sm focus:border-[#CAFF33] outline-none"
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-white text-sm focus:border-[#CAFF33] outline-none"
          />
        </div>
        
        <button className="w-full bg-[#CAFF33] py-3 rounded-lg font-bold text-black text-sm hover:brightness-110 transition-all">
          Login as {role}
        </button>
        
        <button type="button" className="w-full text-gray-500 text-xs hover:text-white transition-all">
          Request system access?
        </button>
      </form>
    </div>
  );
};

export default LoginForm;