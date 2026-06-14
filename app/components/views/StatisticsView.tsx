export default function StatisticsView() {
  return (
    <div>
      <h1 className="text-4xl font-extrabold text-gray-900 mb-1">Statistics</h1>
      <p className="text-gray-500 text-sm leading-relaxed mt-1 mb-6">Insights and charts representing your cash flow.</p>
      <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Charts are being generated</h3>
        <p className="text-gray-400 text-base max-w-md mx-auto">Once you log more transactions, visual analytics of your expenses and income will populate here.</p>
      </div>
    </div>
  );
}
