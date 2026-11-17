import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSubscription } from '../lib/hooks'
import { updateSupplierProfile } from '../lib/queries'

const steps = [
  { id: 1, title: 'Company Profile', icon: 'business' },
  { id: 2, title: 'Add Products', icon: 'inventory_2' },
  { id: 3, title: 'Payment Settings', icon: 'payments' },
  { id: 4, title: 'Complete', icon: 'check_circle' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { supplier } = useAuth()
  const { subscriptionStatus } = useSubscription()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    company_name: supplier?.company_name || '',
    contact_name: supplier?.contact_name || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    city: supplier?.city || '',
    country: supplier?.country || '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!supplier) return
    setLoading(true)
    try {
      await updateSupplierProfile(supplier.id, formData)
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1)
      } else {
        if (subscriptionStatus === 'inactive' || subscriptionStatus === 'past_due') {
          navigate('/subscription')
        }
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface-100 rounded-2xl border border-surface-300 shadow-2xl">
        <div className="p-8">
          <h2 className="text-2xl font-display font-bold text-white text-center mb-8">
            Welcome to Cervos
          </h2>

          <div className="flex justify-center mb-12">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step.id
                      ? 'bg-accent text-white'
                      : 'bg-surface-300 text-gray-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {currentStep > step.id ? 'check' : step.icon}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-0.5 ${
                      currentStep > step.id ? 'bg-accent' : 'bg-surface-300'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="Kariakoo Pharma Distributors Ltd"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Contact Name
              </label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="Amina Juma"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Dar es Salaam"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Tanzania"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-6 py-2.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : currentStep === 4 ? 'Complete' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
