import CameraView from '../components/CameraView'
import VoiceControlPanel from '../components/VoiceControlPanel'
import ModelViewer from '../components/ModelViewer'

export default function DashboardPage(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="min-h-[min(50vh,480px)] shrink-0 overflow-hidden rounded-xl border border-white/10">
        <CameraView />
      </div>
      <div className="flex flex-col xl:flex-row gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <VoiceControlPanel />
        </div>
        <div className="xl:w-80 shrink-0">
          <ModelViewer />
        </div>
      </div>
    </div>
  )
}
