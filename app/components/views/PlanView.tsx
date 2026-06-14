export default function PlanView() {
  return (
    <div>
      <h1 className="text-4xl font-extrabold text-gray-900 mb-1">Plan & Budgeting</h1>
      <p className="text-gray-500 text-sm leading-relaxed mt-1 mb-6">Manage your budgeting limits and targets.</p>
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Budget</h3>
        <div className="w-full bg-gray-100 h-3 rounded-full mb-3">
          <div className="bg-purple-600 h-3 rounded-full" style={{ width: "65%" }}></div>
        </div>
        <div className="flex justify-between text-sm text-gray-500 font-medium">
          <span>Spent: ₱16,250.00</span>
          <span>Limit: ₱25,000.00</span>
        </div>
      </div>
    </div>
  );
}
