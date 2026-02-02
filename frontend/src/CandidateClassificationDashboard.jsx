import React, { useState } from "react";

const CandidateClassificationDashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreRange, setScoreRange] = useState(80);
  const [filters, setFilters] = useState({
    hot: true,
    warm: true,
    cold: false,
    lastActivity: "Anytime",
  });

  // Inline styles for enhanced aesthetics
  const styles = {
    fadeIn: {
      animation: "fadeIn 0.5s ease-in-out",
    },
    slideUp: {
      animation: "slideUp 0.6s ease-out",
    },
    scaleIn: {
      animation: "scaleIn 0.4s ease-out",
    },
    statCard: {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)",
      backdropFilter: "blur(10px)",
      boxShadow:
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    statCardHover: {
      transform: "translateY(-4px)",
      boxShadow:
        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    },
    progressBar: {
      transition: "width 1s ease-out",
      animation: "progressGrow 1.5s ease-out",
    },
    tableRow: {
      transition: "all 0.2s ease",
    },
    badge: {
      fontWeight: "600",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      fontSize: "0.6875rem",
      padding: "0.375rem 0.75rem",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    },
    button: {
      transition: "all 0.2s ease",
      position: "relative",
      overflow: "hidden",
    },
    buttonHover: {
      transform: "translateY(-1px)",
      boxShadow: "0 10px 15px -3px rgba(7, 57, 100, 0.3)",
    },
    filterCard: {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    tabActive: {
      position: "relative",
      transition: "all 0.3s ease",
    },
    inputFocus: {
      outline: "none",
      boxShadow: "0 0 0 3px rgba(7, 57, 100, 0.1)",
      transition: "all 0.2s ease",
    },
  };

  // CSS keyframes as a style tag
  const keyframes = `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes progressGrow {
      from {
        width: 0;
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    .stat-card {
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      transition: left 0.5s;
    }

    .stat-card:hover::before {
      left: 100%;
    }

    .table-row-hover:hover {
      background: linear-gradient(90deg, rgba(7, 57, 100, 0.03) 0%, rgba(7, 57, 100, 0.05) 50%, rgba(7, 57, 100, 0.03) 100%);
      transform: scale(1.001);
    }

    .search-input:focus {
      box-shadow: 0 0 0 3px rgba(7, 57, 100, 0.1);
    }

    .button-primary {
      background: linear-gradient(135deg, #073964 0%, #094c85 100%);
      position: relative;
      overflow: hidden;
    }

    .button-primary::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }

    .button-primary:hover::before {
      width: 300px;
      height: 300px;
    }

    .checkbox-custom:checked {
      background-color: #073964;
      border-color: #073964;
      animation: checkboxPop 0.3s ease;
    }

    @keyframes checkboxPop {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .tab-link {
      position: relative;
      transition: all 0.3s ease;
    }

    .tab-link::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      width: 0;
      height: 3px;
      background: linear-gradient(90deg, #073964, #094c85);
      transform: translateX(-50%);
      transition: width 0.3s ease;
    }

    .tab-link:hover::after {
      width: 100%;
    }

    .score-bar {
      position: relative;
      overflow: hidden;
    }

    .score-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: shimmer 2s infinite;
    }

    .filter-section {
      animation: slideUp 0.5s ease-out;
    }

    .nav-link {
      position: relative;
      transition: all 0.2s ease;
    }

    .nav-link::before {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 2px;
      background: #073964;
      transition: width 0.3s ease;
    }

    .nav-link:hover::before {
      width: 100%;
    }

    .icon-button {
      transition: all 0.2s ease;
    }

    .icon-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .icon-button:active {
      transform: translateY(0);
    }

    .avatar-ring {
      box-shadow: 0 0 0 2px rgba(7, 57, 100, 0.1), 0 0 0 4px rgba(7, 57, 100, 0.05);
      transition: all 0.3s ease;
    }

    .avatar-ring:hover {
      box-shadow: 0 0 0 3px rgba(7, 57, 100, 0.2), 0 0 0 6px rgba(7, 57, 100, 0.1);
      transform: scale(1.05);
    }

    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #073964;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    }

    input[type="range"]::-webkit-slider-thumb:hover {
      background: #094c85;
      transform: scale(1.1);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    }

    input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #073964;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    }

    input[type="range"]::-moz-range-thumb:hover {
      background: #094c85;
      transform: scale(1.1);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    }

    .pagination-button {
      transition: all 0.2s ease;
    }

    .pagination-button:hover {
      background: linear-gradient(135deg, #f0f2f4 0%, #e5e7eb 100%);
      transform: translateY(-1px);
    }

    .pagination-button:active {
      transform: translateY(0);
    }

    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
      background-position: right 0.5rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
      transition: all 0.2s ease;
    }

    select:focus {
      box-shadow: 0 0 0 3px rgba(7, 57, 100, 0.1);
      border-color: #073964;
    }

    .dark .stat-card {
      background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(17, 24, 39, 0.95) 100%);
    }

    .dark .filter-card {
      background: linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(17, 24, 39, 0.98) 100%);
    }

    .dark .table-row-hover:hover {
      background: linear-gradient(90deg, rgba(107, 114, 128, 0.05) 0%, rgba(107, 114, 128, 0.08) 50%, rgba(107, 114, 128, 0.05) 100%);
    }
  `;

  const candidates = [
    {
      id: 1,
      name: "John Doe",
      role: "Senior Frontend Engineer",
      score: 92,
      classification: "HOT",
      lastActivity: "2 hours ago",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAyjXJtB2LVj23qa3RWeeLi6OqrG5_tShZpDg_2AulLg2oBNdBhlhquwiRq8OBJEv2zGvnoPA8q1WB1LwT9nPlk1wKkwU9_VKs-WrD3WQknnValp45y-0G6X7udDy-s_QjJ0QzNVQNutIp2VToXwX3ntsQGe0vN4gaXP0lB6u7jHRJN4_sRpOxUYZFMGilxtUIZufIMPvxFafYHMzsfochspHyRja2QyJaJglkw2BQhmbHVqRDEyL72XJYJXLF8ZF1RYODyQKZhdcA",
    },
    {
      id: 2,
      name: "Sarah Smith",
      role: "Product Designer",
      score: 74,
      classification: "WARM",
      lastActivity: "Yesterday",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuD21Cc1wJ-id_S5TNv6xWzlq-UYucfpXtb0EAR9aVCpveyycDFBTT8kIJg78UpbGfHeNpSnGygGJI4x3mx32OF4oOEdX2gWdDmsS18OVB1uXLou3RwUNDwuaOof6IIJ1CYARORicqUV0ibcRWR9uYiSIyA0vCnv4FrdRHdVPYjL9pd9-8HhIEu77f3V1KeBxPDBoT6YOlUdbb0ziOTMtSUERoyZ-A2wGDHeXsXBdvwV1S3lKNg3xJNy4jHPixM1VV_e-8FktPEZOYs",
    },
    {
      id: 3,
      name: "Michael Brown",
      role: "QA Specialist",
      score: 45,
      classification: "COLD",
      lastActivity: "3 days ago",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAb-RHNIf9ABRfBpBVzvrKVBPwgjyWQqrL0mPTwng5GLljW5vRlVziyG7kTbdsGouCTJf4oXhzycurCMnlZ8m8JT5KE0_hhMkq9q_08pLfHy2khm7tnfZnVlSxkcy8tUVuXWDh20PNh7Qtw-wDBXNP7bvoykqE1Mqxr8FsPXiYzge-n8aOb_nahq7IGeSEU6t1lVpGAuatLdkl9Ly0wXhuo5Z3PnuRw-t7hjMWYGbZIavQHdqoOoueX7jNIRpmAQD80iV3oBF7Y8Jc",
    },
    {
      id: 4,
      name: "Emily Davis",
      role: "Marketing Lead",
      score: 88,
      classification: "HOT",
      lastActivity: "5 hours ago",
      avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBEsT4_s_yrFQZUTPmlQCloKaLr8TfDwhcdenZQ8oyzSEtwFq85e9NOIfGF22kOfyerjFr6f7gxCyBJ-yODuC-RXz-kwEXgHHEAOst6ce6wl5hGFbCrZT9VuGxK_Ea8cW5PSlCN6Nnu-PZ3JIkJEQwn_WS8KZFK3wdGxUEL4HfHxNrBoNW1-MQlcPLJLfKW4wtZXxlRBFH1-cShkxo9YKtFfGG-XCBKXGopIcdEpf-v6AlCyzpT5SndHm_8e5NgH7haVOcWu1Y7FwM",
    },
  ];

  const getClassificationStyle = (classification) => {
    switch (classification) {
      case "HOT":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "WARM":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "COLD":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "";
    }
  };

  const getScoreBarColor = (classification) => {
    switch (classification) {
      case "HOT":
        return "bg-red-500";
      case "WARM":
        return "bg-orange-500";
      case "COLD":
        return "bg-primary/50";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      <style>{keyframes}</style>
      <div
        className="bg-background-light dark:bg-background-dark min-h-screen text-[#111518] dark:text-white"
        style={styles.fadeIn}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-50 bg-white dark:bg-background-dark border-b border-solid border-[#dbe1e6] dark:border-gray-800">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-10 py-3 flex items-center justify-between whitespace-nowrap">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4 text-primary">
                <div className="size-6">
                  <svg
                    fill="none"
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      clipRule="evenodd"
                      d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z"
                      fill="currentColor"
                      fillRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-primary text-xl font-bold leading-tight tracking-[-0.015em]">
                  RecruitCRM
                </h2>
              </div>
              <label className="hidden md:flex flex-col min-w-40 !h-10 max-w-64">
                <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                  <div className="text-[#617789] flex border-none bg-[#f0f2f4] dark:bg-gray-800 items-center justify-center pl-4 rounded-l-lg border-r-0">
                    <span className="material-symbols-outlined text-xl">
                      search
                    </span>
                  </div>
                  <input
                    className="search-input form-input flex w-full min-w-0 flex-1 border-none bg-[#f0f2f4] dark:bg-gray-800 rounded-r-lg text-[#111518] dark:text-white focus:ring-0 h-full placeholder:text-[#617789] px-4 pl-2 text-sm"
                    placeholder="Search candidates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </label>
            </div>
            <div className="flex flex-1 justify-end gap-6 items-center">
              <nav className="hidden lg:flex items-center gap-6">
                <a
                  className="nav-link text-[#111518] dark:text-gray-300 text-sm font-medium hover:text-primary transition-colors"
                  href="#"
                >
                  Dashboard
                </a>
                <a
                  className="text-primary dark:text-white text-sm font-bold border-b-2 border-primary pb-1"
                  href="#"
                >
                  Candidates
                </a>
                <a
                  className="nav-link text-[#111518] dark:text-gray-300 text-sm font-medium hover:text-primary transition-colors"
                  href="#"
                >
                  Jobs
                </a>
                <a
                  className="nav-link text-[#111518] dark:text-gray-300 text-sm font-medium hover:text-primary transition-colors"
                  href="#"
                >
                  Settings
                </a>
              </nav>
              <div className="flex gap-2">
                <button className="icon-button flex items-center justify-center rounded-lg size-10 bg-[#f0f2f4] dark:bg-gray-800 text-[#111518] dark:text-white hover:bg-gray-200 transition-colors">
                  <span className="material-symbols-outlined">
                    notifications
                  </span>
                </button>
                <button className="icon-button flex items-center justify-center rounded-lg size-10 bg-[#f0f2f4] dark:bg-gray-800 text-[#111518] dark:text-white hover:bg-gray-200 transition-colors">
                  <span className="material-symbols-outlined">help</span>
                </button>
              </div>
              <div
                className="avatar-ring bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20 cursor-pointer"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDfOYBbYMEle18-GP_aJARhZlcgljH0YMVK5Ll8wtwVk7RvpS7dNXKzB5mZGWw7T6VsnfaANDlGwNCvpwnpa16WH2r6ZHSldwV14KEEvkI2pxVMxVOmtwuKkOGj6_tGf89J3wJX9Lr9tVG7MLEtJp8bI3Je3JiD4b-Dxi5XsD5Db7YiuLQmMlAwxydQ40v6BA9jVSwxRgF890yQc9xeNhcyrNkxRXCis1lfzO2q_VwlQXcpjvcRRlYO6HdbLs5wRemptoqQ25CsZeY")',
                }}
              ></div>
            </div>
          </div>
        </header>

        <main
          className="max-w-[1440px] mx-auto px-4 sm:px-10 py-8"
          style={styles.slideUp}
        >
          {/* Page Heading */}
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <div className="flex min-w-72 flex-col gap-2">
              <p className="text-[#111518] dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">
                Candidate Classification Dashboard
              </p>
              <p className="text-[#617789] dark:text-gray-400 text-base font-normal">
                Manage and track candidate temperatures across your pipeline
              </p>
            </div>
            <button
              className="button-primary flex min-w-[120px] cursor-pointer items-center justify-center rounded-lg h-11 px-6 bg-primary text-white text-sm font-bold hover:bg-[#094c85] transition-all shadow-md hover:shadow-lg"
              style={styles.button}
            >
              <span className="material-symbols-outlined mr-2 relative z-10">
                person_add
              </span>
              <span className="relative z-10">Add Candidate</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div
              className="stat-card flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-[#dbe1e6] dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
              style={styles.statCard}
            >
              <p className="text-[#617789] dark:text-gray-400 text-sm font-medium uppercase tracking-wider">
                Total Candidates
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-[#111518] dark:text-white text-3xl font-bold">
                  1,240
                </p>
                <p className="text-[#078838] text-xs font-bold">+12%</p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: "100%", ...styles.progressBar }}
                ></div>
              </div>
            </div>
            <div
              className="stat-card flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-[#dbe1e6] dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
              style={styles.statCard}
            >
              <p className="text-[#617789] dark:text-gray-400 text-sm font-medium uppercase tracking-wider">
                Hot (High Score)
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-[#111518] dark:text-white text-3xl font-bold">
                  156
                </p>
                <p className="text-[#078838] text-xs font-bold">+5%</p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                <div
                  className="bg-red-500 h-full rounded-full"
                  style={{ width: "15%", ...styles.progressBar }}
                ></div>
              </div>
            </div>
            <div
              className="stat-card flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-[#dbe1e6] dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
              style={styles.statCard}
            >
              <p className="text-[#617789] dark:text-gray-400 text-sm font-medium uppercase tracking-wider">
                Warm (Interested)
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-[#111518] dark:text-white text-3xl font-bold">
                  432
                </p>
                <p className="text-[#e73908] text-xs font-bold">-2%</p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                <div
                  className="bg-orange-500 h-full rounded-full"
                  style={{ width: "35%", ...styles.progressBar }}
                ></div>
              </div>
            </div>
            <div
              className="stat-card flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-[#dbe1e6] dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow"
              style={styles.statCard}
            >
              <p className="text-[#617789] dark:text-gray-400 text-sm font-medium uppercase tracking-wider">
                Cold (Inactive)
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-[#111518] dark:text-white text-3xl font-bold">
                  652
                </p>
                <p className="text-[#078838] text-xs font-bold">+8%</p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2">
                <div
                  className="bg-primary/40 h-full rounded-full"
                  style={{ width: "50%", ...styles.progressBar }}
                ></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Filters */}
            <aside className="w-full lg:w-64 flex-shrink-0">
              <div
                className="filter-card filter-section bg-white dark:bg-gray-900 border border-[#dbe1e6] dark:border-gray-800 rounded-xl p-6 shadow-sm sticky top-24"
                style={styles.filterCard}
              >
                <h3 className="text-[#111518] dark:text-white text-lg font-bold mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-primary">
                    filter_list
                  </span>
                  Pipeline Filters
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-[#111518] dark:text-gray-200">
                      Score Range
                    </label>
                    <input
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      max="100"
                      min="0"
                      type="range"
                      value={scoreRange}
                      onChange={(e) => setScoreRange(e.target.value)}
                    />
                    <div className="flex justify-between text-xs text-[#617789] mt-2">
                      <span>0</span>
                      <span className="font-semibold text-primary">
                        {scoreRange}
                      </span>
                      <span>100</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-[#111518] dark:text-gray-200">
                      Temperature
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          checked={filters.hot}
                          className="checkbox-custom rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                          type="checkbox"
                          onChange={(e) =>
                            setFilters({ ...filters, hot: e.target.checked })
                          }
                        />
                        <span className="text-sm text-[#617789] group-hover:text-primary transition-colors">
                          Hot Candidates
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          checked={filters.warm}
                          className="checkbox-custom rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                          type="checkbox"
                          onChange={(e) =>
                            setFilters({ ...filters, warm: e.target.checked })
                          }
                        />
                        <span className="text-sm text-[#617789] group-hover:text-primary transition-colors">
                          Warm Candidates
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          checked={filters.cold}
                          className="checkbox-custom rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                          type="checkbox"
                          onChange={(e) =>
                            setFilters({ ...filters, cold: e.target.checked })
                          }
                        />
                        <span className="text-sm text-[#617789] group-hover:text-primary transition-colors">
                          Cold Candidates
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-[#111518] dark:text-gray-200">
                      Last Activity
                    </label>
                    <select
                      className="w-full rounded-lg border-[#dbe1e6] dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-primary focus:border-primary"
                      value={filters.lastActivity}
                      onChange={(e) =>
                        setFilters({ ...filters, lastActivity: e.target.value })
                      }
                    >
                      <option>Anytime</option>
                      <option>Last 24 hours</option>
                      <option>Last 7 days</option>
                      <option>Last 30 days</option>
                    </select>
                  </div>
                  <button
                    className="w-full py-2.5 text-sm font-bold text-primary dark:text-primary border border-primary/20 bg-primary/5 rounded-lg hover:bg-primary/10 transition-all hover:shadow-sm"
                    onClick={() =>
                      setFilters({
                        hot: true,
                        warm: true,
                        cold: false,
                        lastActivity: "Anytime",
                      })
                    }
                    style={styles.button}
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tabs */}
              <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-[#dbe1e6] dark:border-gray-800">
                <div className="flex border-b border-[#dbe1e6] dark:border-gray-800 px-6 gap-8 overflow-x-auto no-scrollbar">
                  <a
                    className="flex flex-col items-center justify-center border-b-[3px] border-primary text-primary pb-3 pt-4 font-bold text-sm whitespace-nowrap"
                    href="#"
                    style={styles.tabActive}
                  >
                    All Candidates
                  </a>
                  <a
                    className="tab-link flex flex-col items-center justify-center border-b-[3px] border-transparent text-[#617789] hover:text-primary pb-3 pt-4 font-bold text-sm transition-colors whitespace-nowrap"
                    href="#"
                  >
                    Hot{" "}
                    <span className="ml-1 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                      156
                    </span>
                  </a>
                  <a
                    className="tab-link flex flex-col items-center justify-center border-b-[3px] border-transparent text-[#617789] hover:text-primary pb-3 pt-4 font-bold text-sm transition-colors whitespace-nowrap"
                    href="#"
                  >
                    Warm{" "}
                    <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                      432
                    </span>
                  </a>
                  <a
                    className="tab-link flex flex-col items-center justify-center border-b-[3px] border-transparent text-[#617789] hover:text-primary pb-3 pt-4 font-bold text-sm transition-colors whitespace-nowrap"
                    href="#"
                  >
                    Cold{" "}
                    <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                      652
                    </span>
                  </a>
                </div>

                {/* Candidate Pipeline Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-background-light dark:bg-gray-800/50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-[#617789] uppercase tracking-wider">
                          Name &amp; Role
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-[#617789] uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-[#617789] uppercase tracking-wider">
                          Classification
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-[#617789] uppercase tracking-wider">
                          Last Activity
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-[#617789] uppercase tracking-wider text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dbe1e6] dark:divide-gray-800">
                      {candidates.map((candidate) => (
                        <tr
                          key={candidate.id}
                          className="table-row-hover hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                          style={styles.tableRow}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="size-10 rounded-full bg-cover bg-center ring-2 ring-gray-100 dark:ring-gray-800 transition-all hover:ring-primary/20"
                                style={{
                                  backgroundImage: `url("${candidate.avatar}")`,
                                }}
                              ></div>
                              <div>
                                <p className="font-bold text-[#111518] dark:text-white">
                                  {candidate.name}
                                </p>
                                <p className="text-xs text-[#617789]">
                                  {candidate.role}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#111518] dark:text-white">
                                {candidate.score}
                              </span>
                              <div className="score-bar w-16 bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                                <div
                                  className={`${getScoreBarColor(
                                    candidate.classification
                                  )} h-full rounded-full`}
                                  style={{
                                    width: `${candidate.score}%`,
                                    ...styles.progressBar,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${getClassificationStyle(
                                candidate.classification
                              )}`}
                              style={styles.badge}
                            >
                              {candidate.classification}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#617789]">
                            {candidate.lastActivity}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-primary hover:text-[#094c85] font-bold text-sm hover:underline transition-all">
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-5 flex items-center justify-between border-t border-[#dbe1e6] dark:border-gray-800">
                  <p className="text-sm text-[#617789]">
                    Showing{" "}
                    <span className="font-semibold text-[#111518] dark:text-white">
                      1-4
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#111518] dark:text-white">
                      1,240
                    </span>{" "}
                    results
                  </p>
                  <div className="flex gap-2">
                    <button className="pagination-button flex items-center justify-center rounded-lg h-9 px-3 border border-[#dbe1e6] dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111518] dark:text-white text-sm font-medium hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-outlined text-lg">
                        chevron_left
                      </span>
                    </button>
                    <button className="pagination-button flex items-center justify-center rounded-lg h-9 px-3 border border-[#dbe1e6] dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111518] dark:text-white text-sm font-medium hover:bg-gray-50 transition-colors">
                      <span className="material-symbols-outlined text-lg">
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Simple Footer */}
        <footer className="max-w-[1440px] mx-auto px-10 py-10 mt-10 border-t border-[#dbe1e6] dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 opacity-60">
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 48 48"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z"
                  fill="#073964"
                />
              </svg>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                RecruitCRM © 2024
              </span>
            </div>
            <div className="flex gap-6">
              <a className="text-xs text-[#617789] hover:text-primary" href="#">
                Privacy Policy
              </a>
              <a className="text-xs text-[#617789] hover:text-primary" href="#">
                Terms of Service
              </a>
              <a className="text-xs text-[#617789] hover:text-primary" href="#">
                Contact Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default CandidateClassificationDashboard;
