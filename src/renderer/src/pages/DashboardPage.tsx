import CameraView from '../components/CameraView'
import VoiceControlPanel from '../components/VoiceControlPanel'

export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 h-full">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      <VoiceControlPanel />
      <div className="flex-1 rounded-xl overflow-hidden border border-white/10">
        <CameraView />
      </div>
    </div>
  )
}
