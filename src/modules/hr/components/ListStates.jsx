/** `boxed`: Employees' loading state wraps the icon in a colored box; the rest (Departments, Positions, Attendance, Movement, Leave, Payroll) use a bare pulsing icon — kept configurable to match each exactly. */
export function ListLoading({ icon: Icon, label, boxed = false }) {
  if (boxed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-pink-400 animate-pulse" />
        </div>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Icon className="w-8 h-8 text-pink-400 animate-pulse" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  )
}
