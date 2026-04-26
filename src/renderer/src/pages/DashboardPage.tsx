import CameraView from '../components/CameraView'
import VoiceControlPanel from '../components/VoiceControlPanel'
import ModelViewer from '../components/ModelViewer'

export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <h1 className="shrink-0 text-xl font-semibold text-white">Dashboard</h1>
      <div className="min-h-[min(50vh,480px)] shrink-0 overflow-hidden rounded-xl border border-white/10">
        <CameraView />
      </div>
      <div className="shrink-0">
        <VoiceControlPanel />
      </div>
      <div className="shrink-0">
        <ModelViewer />
      </div>
    </div>
  )
}
