import { useEffect, useState } from "react";

const getStoredUser = () => {
  try {
    const userRaw = localStorage.getItem("user");
    return userRaw ? JSON.parse(userRaw) : {};
  } catch {
    return {};
  }
};

export default function Profile() {
  const [user, setUser] = useState({ name: "", email: "" });
  const [nameInput, setNameInput] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedUser = getStoredUser();
    const userName = storedUser?.name || "";
    const userEmail = storedUser?.email || "";

    setUser({ name: userName, email: userEmail });
    setNameInput(userName);
  }, []);

  const handleSave = (event) => {
    event.preventDefault();

    const trimmedName = nameInput.trim();

    if (!trimmedName) {
      setMessage("Please enter your name.");
      return;
    }

    const storedUser = getStoredUser();
    const updatedUser = {
      ...storedUser,
      name: trimmedName,
    };

    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser((previous) => ({ ...previous, name: trimmedName }));
    setMessage("Profile updated successfully.");

    window.dispatchEvent(new Event("userUpdated"));
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-black flex justify-center px-6 py-16">

    <div className="w-full max-w-4xl">

      <div className="mb-10">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          My Profile
        </h1>
        <p className="text-slate-400 mt-2">
          Manage your account information and personal details.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl"
      >

        <div className="grid md:grid-cols-2 gap-8">

          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm">Email Address</label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Email cannot be changed.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-slate-400 text-sm">Full Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Enter your full name"
              className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            />
          </div>

        </div>

        {message && (
          <div className="mt-8 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-4">
            {message}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <button
            type="submit"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-medium hover:opacity-90 transition shadow-lg"
          >
            Save Changes
          </button>
        </div>

      </form>

    </div>
  </div>
);
}
