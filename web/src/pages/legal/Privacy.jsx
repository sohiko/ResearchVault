import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
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
          プライバシーポリシー
        </h1>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-secondary-700 dark:text-secondary-300">
          <section>
            <p>
              ResearchVault（以下「当サービス」といいます）は、本ウェブサイト上で提供するサービス（以下「本サービス」といいます）における、
              ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第1条（個人情報）</h2>
            <p>
              「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、
              当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び
              容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第2条（個人情報の収集方法）</h2>
            <p>当サービスは、ユーザーが利用登録をする際に氏名、メールアドレスなどの個人情報をお尋ねすることがあります。</p>
            <p className="mt-3">
              また、ユーザーと提携先などとの間でなされたユーザーの個人情報を含む取引記録や決済に関する情報を、
              当サービスの提携先（情報提供元、広告主、広告配信先などを含みます。以下「提携先」といいます。）などから収集することがあります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第3条（個人情報を収集・利用する目的）</h2>
            <p>当サービスが個人情報を収集・利用する目的は、以下のとおりです。</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>当サービスのサービスの提供・運営のため</li>
              <li>ユーザーからのお問い合わせに回答するため（本人確認を行うことを含む）</li>
              <li>ユーザーが利用中のサービスの新機能、更新情報、キャンペーン等及び当サービスが提供する他のサービスの案内のメールを送付するため</li>
              <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
              <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
              <li>ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
              <li>サービスの改善、新サービスの開発のため</li>
              <li>上記の利用目的に付随する目的</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第4条（利用目的の変更）</h2>
            <p>
              当サービスは、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。
            </p>
            <p className="mt-3">
              利用目的の変更を行った場合には、変更後の目的について、当サービス所定の方法により、ユーザーに通知し、
              または本ウェブサイト上に公表するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第5条（個人情報の第三者提供）</h2>
            <p>
              当サービスは、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
              ただし、個人情報保護法その他の法令で認められる場合を除きます。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
              <li>予め次の事項を告知あるいは公表し、かつ当サービスが個人情報保護委員会に届出をしたとき
                <ul className="list-circle list-inside ml-6 mt-1 space-y-1">
                  <li>利用目的に第三者への提供を含むこと</li>
                  <li>第三者に提供されるデータの項目</li>
                  <li>第三者への提供の手段または方法</li>
                  <li>本人の求めに応じて個人情報の第三者への提供を停止すること</li>
                  <li>本人の求めを受け付ける方法</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第6条（個人情報の開示）</h2>
            <p>
              当サービスは、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。
              ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、
              開示しない決定をした場合には、その旨を遅滞なく通知します。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
              <li>当サービスの業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
              <li>その他法令に違反することとなる場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第7条（個人情報の訂正および削除）</h2>
            <p>
              ユーザーは、当サービスの保有する自己の個人情報が誤った情報である場合には、当サービスが定める手続きにより、
              当サービスに対して個人情報の訂正、追加または削除（以下「訂正等」といいます。）を請求することができます。
            </p>
            <p className="mt-3">
              当サービスは、ユーザーから前項の請求を受けてその請求に応じる必要があると判断した場合には、
              遅滞なく、当該個人情報の訂正等を行うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第8条（個人情報の利用停止等）</h2>
            <p>
              当サービスは、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、
              または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下「利用停止等」といいます。）を
              求められた場合には、遅滞なく必要な調査を行います。
            </p>
            <p className="mt-3">
              前項の調査結果に基づき、その請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の利用停止等を行います。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第9条（Cookie等の技術の利用）</h2>
            <p>
              当サービスは、ユーザーの利便性向上およびサービス品質の向上を目的として、Cookie及びこれに類する技術を使用することがあります。
            </p>
            <p className="mt-3">
              これらの技術により、当サービスはユーザーの訪問状況やブラウザの種類等の情報を収集することがあります。
            </p>
            <p className="mt-3">
              ユーザーはブラウザの設定によりCookieを無効にすることができますが、
              その場合、本サービスの一部の機能がご利用いただけなくなることがあります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第10条（第三者サービスの利用）</h2>
            <p>本サービスでは、以下の第三者サービスを利用しています。</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>
                <strong>Supabase</strong>：データベースおよび認証サービス
                <br />
                <span className="text-sm">ユーザー情報、研究資料データ等を安全に保管・管理するために使用します。</span>
              </li>
              <li>
                <strong>Google Gemini API</strong>：AI分析サービス
                <br />
                <span className="text-sm">研究資料の自動分類、PDF情報抽出等のAI機能に使用します。</span>
              </li>
              <li>
                <strong>Microlink.io</strong>：メタデータ抽出サービス
                <br />
                <span className="text-sm">Webページの情報自動取得に使用します。</span>
              </li>
              <li>
                <strong>Vercel</strong>：ホスティングサービス
                <br />
                <span className="text-sm">Webアプリケーションの配信に使用します。</span>
              </li>
            </ul>
            <p className="mt-3">
              これらのサービスは、それぞれ独自のプライバシーポリシーに基づいて個人情報を取り扱います。
              詳細は各サービスのプライバシーポリシーをご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第11条（Chrome拡張機能について）</h2>
            <p>
              当サービスが提供するChrome拡張機能は、以下の情報を収集・利用します。
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>閲覧履歴：研究資料候補の提案のため</li>
              <li>ブックマーク：研究資料の整理のため</li>
              <li>ページ内で選択したテキスト：引用管理のため</li>
              <li>訪問したWebページのメタデータ：資料情報の自動取得のため</li>
            </ul>
            <p className="mt-3">
              これらの情報は、ユーザーの明示的な操作（保存ボタンのクリック等）によってのみ保存され、
              ユーザーの同意なく第三者に提供されることはありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第12条（データの保存期間）</h2>
            <p>
              当サービスは、ユーザーの個人情報を、サービス提供に必要な期間保存します。
            </p>
            <p className="mt-3">
              ユーザーがアカウントを削除した場合、個人情報は遅滞なく削除されます。
              ただし、法令により保存が義務付けられている場合は、その期間保存します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第13条（セキュリティ）</h2>
            <p>
              当サービスは、個人情報の漏洩、滅失またはき損の防止その他の個人情報の安全管理のために必要かつ適切な措置を講じます。
            </p>
            <p className="mt-3">
              具体的には、SSL/TLS暗号化通信、アクセス制御、セキュリティアップデートの適用等の技術的・組織的対策を実施しています。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第14条（プライバシーポリシーの変更）</h2>
            <p>
              本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。
            </p>
            <p className="mt-3">
              当サービスが別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">第15条（お問い合わせ窓口）</h2>
            <p>
              本ポリシーに関するお問い合わせは、サービス内のフィードバック機能からご連絡ください。
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

