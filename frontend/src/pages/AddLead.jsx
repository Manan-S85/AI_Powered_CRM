import React, { useState } from "react";

export default function AddLeadSample() {
  const [lead, setLead] = useState({
    name: "",
    email: "",
    role_position: "",
    years_of_experience: 0,
    location: "",
    interview_status: "New",
    ml_prediction: { predicted_temperature: "Hot", confidence: 0.0 },
  });

  const handleChange = (e) => {
  const { name, value } = e.target;

  setLead({
    ...lead,
    [name]: name === "years_of_experience" ? Number(value) : value,
  });
};

  const handleSubmit = () => {
    alert("Lead added (mock)\n" + JSON.stringify(lead, null, 2));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex justify-center">
      <div className="bg-white w-full md:w-3/4 lg:w-2/3 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-6">Add New Lead</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="font-semibold text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={lead.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={lead.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-700">Role / Position</label>
            <input
              type="text"
              name="role_position"
              value={lead.role_position}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-700">Years of Experience</label>
            <input
              type="number"
              name="years_of_experience"
              value={lead.years_of_experience}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-700">Location</label>
            <input
              type="text"
              name="location"
              value={lead.location}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-700">Interview Status</label>
            <select
              name="interview_status"
              value={lead.interview_status}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option>New</option>
              <option>Scheduled</option>
              <option>Completed</option>
              <option>Rejected</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => alert("Cancelled")}
            className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Add Lead
          </button>
        </div>
      </div>
    </div>
  );
}
