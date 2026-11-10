import { Plus } from 'lucide-react'
import { FAQ } from './content'
import { Reveal } from './Reveal'

export function Faq() {
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title">
      <Reveal className="section-head">
        <p className="eyebrow">FAQ</p>
        <h2 id="faq-title">A few good questions.</h2>
      </Reveal>
      <div className="faq-list">
        {FAQ.map((item, index) => (
          <Reveal key={item.question} delay={index * 50}>
            <details className="faq-item">
              <summary>
                {item.question}
                <Plus aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
