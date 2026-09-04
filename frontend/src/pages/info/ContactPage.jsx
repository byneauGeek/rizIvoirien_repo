import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, MessageSquare, Send, CheckCircle } from 'lucide-react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // Simulate send
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      {/* Header */}
      <div className="bg-[#1B4332] text-white py-20 px-6 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-xl">🌾</span>
          <span className="font-playfair text-lg font-bold">Riz<span className="text-[#E8A217]">Ivoirien</span></span>
        </Link>
        <h1 className="font-playfair text-4xl md:text-5xl font-bold mb-4">Nous contacter</h1>
        <p className="font-dm text-lg text-white/60 max-w-xl mx-auto">
          Notre équipe est disponible du lundi au vendredi, 8h–18h (GMT).
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-5 gap-12">
        {/* Info cards */}
        <div className="md:col-span-2 space-y-5">
          {[
            { icon: Mail, label: 'Email', value: 'support@rizivoirien.ci', href: 'mailto:support@rizivoirien.ci' },
            { icon: Phone, label: 'Téléphone', value: '+225 07 00 00 00 00', href: 'tel:+2250700000000' },
            { icon: MapPin, label: 'Adresse', value: "Abidjan, Plateau, Côte d'Ivoire", href: null },
            { icon: MessageSquare, label: 'WhatsApp', value: '+225 07 00 00 00 00', href: 'https://wa.me/2250700000000' },
          ].map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1B4332]/10 flex items-center justify-center">
                  <Icon size={16} className="text-[#1B4332]" />
                </div>
                <div>
                  <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                  {href
                    ? <a href={href} className="font-dm text-sm font-medium text-[#0F1923] hover:text-[#52B788] transition-colors">{value}</a>
                    : <p className="font-dm text-sm font-medium text-[#0F1923]">{value}</p>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="md:col-span-3 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          {sent ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#52B788]/15 flex items-center justify-center">
                <CheckCircle size={32} className="text-[#52B788]" />
              </div>
              <h2 className="font-playfair text-2xl font-bold text-[#0F1923]">Message envoyé !</h2>
              <p className="font-dm text-[#0F1923]/50">Nous vous répondrons dans les 24h ouvrées.</p>
              <button onClick={() => setSent(false)} className="mt-4 font-syne text-sm font-bold text-[#52B788] hover:underline">
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="font-playfair text-2xl font-bold text-[#0F1923] mb-6">Envoyez-nous un message</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Votre nom" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                <Field label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <Field label="Sujet" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required />
              <div>
                <label className="font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 block mb-1.5">Message</label>
                <textarea rows={5} required value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 font-dm text-sm resize-none focus:outline-none focus:border-[#52B788]"
                  placeholder="Décrivez votre demande…" />
              </div>
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-[#1B4332] text-white font-syne font-bold py-3.5 rounded-xl hover:bg-[#246043] transition-colors">
                <Send size={15} /> Envoyer le message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="font-syne text-xs font-bold uppercase tracking-wider text-[#0F1923]/40 block mb-1.5">{label}</label>
      <input type={type} {...props}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm focus:outline-none focus:border-[#52B788]" />
    </div>
  )
}
