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
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <p className="text-gray-600 mt-1">Manage your basic account details.</p>

      <form
        onSubmit={handleSave}
        className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email ID</label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="mt-2 w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Enter your full name"
              className="mt-2 w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {message && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Save Name
          </button>
        </div>
      </form>
    </div>
  );
}
