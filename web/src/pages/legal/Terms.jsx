import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-secondary-800 rounded-lg shadow-md p-8">
        <div className="mb-8">
          <Link 
            to="/dashboard" 
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100 mb-8">
          利用規約
        </h1>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-secondary-700 dark:text-secondary-300">
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第1条（適用）</h2>
            <p>
              本利用規約（以下「本規約」といいます）は、ResearchVault（以下「当サービス」といいます）の利用条件を定めるものです。
              登録ユーザーの皆さま（以下「ユーザー」といいます）には、本規約に従って、当サービスをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第2条（利用登録）</h2>
            <p>
              当サービスにおいては、登録希望者が本規約に同意の上、当サービスの定める方法によって利用登録を申請し、
              当サービスがこれを承認することによって、利用登録が完了するものとします。
            </p>
            <p className="mt-3">
              当サービスは、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、
              その理由については一切の開示義務を負わないものとします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
              <li>本規約に違反したことがある者からの申請である場合</li>
              <li>その他、当サービスが利用登録を相当でないと判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第3条（ユーザーIDおよびパスワードの管理）</h2>
            <p>
              ユーザーは、自己の責任において、当サービスのユーザーIDおよびパスワードを適切に管理するものとします。
            </p>
            <p className="mt-3">
              ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、
              もしくは第三者と共用することはできません。
            </p>
            <p className="mt-3">
              当サービスは、ユーザーIDとパスワードの組み合わせが登録情報と一致してログインされた場合には、
              そのユーザーIDを登録しているユーザー自身による利用とみなします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第4条（禁止事項）</h2>
            <p>ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
              <li>当サービスの運営を妨害するおそれのある行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>不正アクセスをし、またはこれを試みる行為</li>
              <li>他のユーザーに成りすます行為</li>
              <li>当サービスが許諾しない方法で営業活動に利用する行為</li>
              <li>当サービスのサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
              <li>その他、当サービスが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第5条（本サービスの提供の停止等）</h2>
            <p>
              当サービスは、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
              <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
              <li>コンピュータまたは通信回線等が事故により停止した場合</li>
              <li>その他、当サービスが本サービスの提供が困難と判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第6条（著作権）</h2>
            <p>
              ユーザーが当サービスを利用して保存した研究資料、引用情報、メモ等のコンテンツの著作権は、
              当該ユーザーまたは原著作者に帰属するものとします。
            </p>
            <p className="mt-3">
              当サービスは、ユーザーが保存したコンテンツについて、サービスの提供、改善、プロモーション等の目的で利用することができるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第7条（利用制限および登録抹消）</h2>
            <p>
              当サービスは、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、
              ユーザーに対して、本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>本規約のいずれかの条項に違反した場合</li>
              <li>登録事項に虚偽の事実があることが判明した場合</li>
              <li>料金等の支払債務の不履行があった場合</li>
              <li>当サービスからの連絡に対し、一定期間返答がない場合</li>
              <li>本サービスについて、最終の利用から一定期間利用がない場合</li>
              <li>その他、当サービスが本サービスの利用を適当でないと判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第8条（免責事項）</h2>
            <p>
              当サービスは、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、
              特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを
              明示的にも黙示的にも保証しておりません。
            </p>
            <p className="mt-3">
              当サービスは、本サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第9条（サービス内容の変更等）</h2>
            <p>
              当サービスは、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、
              これによってユーザーに生じた損害について一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第10条（利用規約の変更）</h2>
            <p>
              当サービスは、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第11条（個人情報の取扱い）</h2>
            <p>
              当サービスは、本サービスの利用によって取得する個人情報については、当サービス
              「<Link to="/privacy" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">プライバシーポリシー</Link>」
              に従い適切に取り扱うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第12条（通知または連絡）</h2>
            <p>
              ユーザーと当サービスとの間の通知または連絡は、当サービスの定める方法によって行うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第13条（権利義務の譲渡の禁止）</h2>
            <p>
              ユーザーは、当サービスの書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を
              第三者に譲渡し、または担保に供することはできません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第14条（準拠法・裁判管轄）</h2>
            <p>
              本規約の解釈にあたっては、日本法を準拠法とします。
            </p>
            <p className="mt-3">
              本サービスに関して紛争が生じた場合には、当サービスの所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>

          <div className="mt-8 pt-8 border-t border-secondary-200 dark:border-secondary-700">
            <p className="text-sm text-secondary-500">最終更新日：2025年10月22日</p>
          </div>
        </div>
      </div>
    </div>
  )
}

