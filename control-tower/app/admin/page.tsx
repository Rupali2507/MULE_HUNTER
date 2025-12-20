"use client";
import { useState } from 'react';
import Navbar from '../components/Navbar';

export default function AdminPage() {
  const [role, setRole] = useState('Viewer');
  const roles = ['Admin', 'Investigator', 'Viewer'];

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-[#141414] text-white font-sans">
      <Navbar/>

      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 md:p-10 overflow-hidden">
        
        {/* LEFT: Create User Form */}
        <section className="w-full md:w-1/3 bg-[#1C1C1C] p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col justify-center">
          <header className="mb-6">
            <h1 className="text-[#CAFF33] text-2xl font-semibold">System Access</h1>
            <p className="text-gray-400 text-sm">Provision new credentials for the network.</p>
          </header>

          <form className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-500 ml-1">Assign Role</label>
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

            <div className="space-y-4">
              <input type="text" placeholder="Full Name" className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none" />
              <input type="email" placeholder="Email Address" className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none" />
              <input type="password" placeholder="Temporary Password" className="w-full bg-[#141414] border border-gray-800 p-3 rounded-lg text-sm focus:border-[#CAFF33] outline-none" />
            </div>

            <button type="submit" className="w-full bg-[#CAFF33] py-3 rounded-lg font-bold text-black text-sm hover:brightness-110 transition-all">
              Create {role} Account
            </button>
          </form>
        </section>

        {/* RIGHT: User Directory List */}
        <section className="flex-1 bg-[#1C1C1C] p-6 rounded-2xl border border-gray-800 shadow-xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Active Personnel</h2>
            <span className="bg-[#262626] text-gray-400 text-[10px] px-3 py-1 rounded-full border border-gray-700">3 Total Users</span>
          </div>

          <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {/* Example User Row */}
            {[
              { name: "Admin User", email: "admin@mulehunter.io", role: "Admin" },
              { name: "John Doe", email: "j.doe@investigation.com", role: "Investigator" },
              { name: "Sarah Smith", email: "sarah.s@view.org", role: "Viewer" }
            ].map((user, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-gray-800 hover:border-gray-700 transition-all">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    user.role === 'Admin' ? 'text-[#CAFF33] border-[#CAFF33]/30 bg-[#CAFF33]/5' : 'text-gray-400 border-gray-700 bg-gray-800/20'
                  }`}>
                    {user.role}
                  </span>
                  <button className="text-red-500 text-xs hover:underline">Revoke</button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      <footer className="bg-[#1A1A1A] py-4 border-t border-gray-800 text-center text-gray-500 text-[10px]">
        MULE HUNTER ADMINISTRATIVE CONTROL PANEL v1.0
      </footer>
    </main>
  );
}