# Native Build and OTA Continuity Audit — 2026-09-10

## Build baseline

The native build must be created from `main` at commit `3431897bfdd5642c3c9bae18dcb248e418960d5f` (`Harden message and personalization routes`). The latest successful production OTA was built from `610015c418f7d5863d3f378f043eb7345a1f2e08` (`Place share beside save action`). Therefore, the native build source contains the latest shipped production source plus the Message and Today personalization crash fixes.

The app uses Expo runtime policy `appVersion`, with the current app version set to `1.0.0`. Production native builds use the EAS `production` profile and `production` channel with automatic version incrementing. OTA updates publish to the same `production` channel for both iOS and Android. The Expo project ID is `13230e71-d40b-45c8-8709-176f0c021198` and the bundle identifiers are `com.uvel.dressandshop` for both platforms.

The new native build includes the `expo-tracking-transparency` native module and plugin. The JavaScript fallback remains guarded so the current binary can safely receive an OTA, while the new binary will enable the optional native iOS tracking prompt.

## OTA inventory

The table below lists every successful OTA workflow run returned by GitHub for the repository’s legacy `OTA` workflow and the current `Publish OTA update` workflow. Duplicate workflow runs for the same source commit are retained because each represents a separately published workflow execution.

| Created (UTC) | Run ID | Source commit | Workflow | GitHub run |
|---|---:|---|---|---|
| 2026-08-29T21:58:27Z | 33277401284 | `4b4102a7ff614e5d93544d715b0253a0dc23eaca` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33277401284) |
| 2026-08-30T12:40:01Z | 33312091472 | `231955e52aa9bdf21e140ecc3fd66436e6d6b272` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33312091472) |
| 2026-08-30T13:26:14Z | 33314176651 | `269925e26ed3d178f75c2b959c32cbf4b509826e` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33314176651) |
| 2026-08-30T13:58:24Z | 33315591611 | `e1bb5ca175d70ade4a88e3c0e291c43bea1519f2` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33315591611) |
| 2026-08-30T15:26:52Z | 33319661007 | `db47b29e59199c05b87e9fa94b4eaae4a3172d72` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33319661007) |
| 2026-09-01T01:56:35Z | 33460656666 | `22c949e2ca6cfe3b92fcdc352a513046fef1feff` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33460656666) |
| 2026-09-01T12:06:12Z | 33505872507 | `16aeeca84a58bbc7fa439214b7cebbee54d12c47` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33505872507) |
| 2026-09-01T12:21:56Z | 33507269761 | `b19a321f53a48983d8b0d7f9d800d2be11af0b88` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33507269761) |
| 2026-09-01T12:47:53Z | 33509659059 | `05d9d0dee92c63083c98a011967f1263d31d55b4` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33509659059) |
| 2026-09-01T13:00:37Z | 33510860505 | `ebe89882d727e8863cbbe304fe97281fe303e097` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33510860505) |
| 2026-09-01T17:41:45Z | 33539283911 | `f7e1e652068778c86b139a5280b96d673b41961d` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33539283911) |
| 2026-09-01T17:50:11Z | 33540099532 | `c84888e1adde406f661bdaa29ac87d1a76c89036` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33540099532) |
| 2026-09-01T18:08:46Z | 33541907787 | `df79fa41e5e9d78cdd471541b9fbf11653bde675` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33541907787) |
| 2026-09-01T18:32:16Z | 33544206405 | `709883f4ed73f209a7cbab11abb10162752a161a` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33544206405) |
| 2026-09-01T18:39:47Z | 33544952109 | `e93684edf920d440b94cccf61426f6df45843f95` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33544952109) |
| 2026-09-01T19:06:53Z | 33547601706 | `221669f80ed16c3bb781986743e589412c495960` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33547601706) |
| 2026-09-01T19:35:12Z | 33550363058 | `f4fb53610743b9f1ad03bb8137594cec900c5fda` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33550363058) |
| 2026-09-01T19:40:26Z | 33550873438 | `a9f00661f13a57ef98e8dc8a187d1ab70d3e2abd` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33550873438) |
| 2026-09-02T20:32:46Z | 33679919263 | `3fcf4f479330a76c11dc16c0258e875685b8da93` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33679919263) |
| 2026-09-02T21:29:46Z | 33685449702 | `060a1055b584c0533bb098bdcad2f0a6c2df312a` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33685449702) |
| 2026-09-02T21:42:00Z | 33686553942 | `4288808a83ee4cd05ec252770d467785f2092b41` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33686553942) |
| 2026-09-02T21:49:02Z | 33687176792 | `43add58a5921ffb690f177a99ec5381a828a60d4` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33687176792) |
| 2026-09-02T21:56:07Z | 33687789558 | `da4c8596d245c79a9dad12e83f251c2bba8d3478` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33687789558) |
| 2026-09-02T22:08:32Z | 33688868033 | `298f6893974b612766e136aa861b4a3107f07269` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33688868033) |
| 2026-09-03T12:52:38Z | 33757755779 | `a42a42b7a01589508e096ea36c4d8741e20c2744` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33757755779) |
| 2026-09-03T12:56:31Z | 33758146887 | `398f4fa2b3ffaa87783a811544d3feb6bf9cdd04` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33758146887) |
| 2026-09-03T13:07:52Z | 33759288390 | `7e3cd04608d2bfc62d64979c34d81e18ab8a1c26` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33759288390) |
| 2026-09-03T13:16:55Z | 33760211275 | `23e6069fe2a793933ee9690c09f210486091adfa` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33760211275) |
| 2026-09-03T13:22:10Z | 33760752102 | `23e6069fe2a793933ee9690c09f210486091adfa` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33760752102) |
| 2026-09-03T13:35:10Z | 33761955829 | `3291e83cb71ddeebcaa8d1e60af5a11ce4947161` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33761955829) |
| 2026-09-03T13:58:49Z | 33764170353 | `26571b972ac80a8b72acb6d8067a80ba6a1fab96` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33764170353) |
| 2026-09-03T14:09:27Z | 33765201816 | `1020a320c1428de667184a04ded92a937a394f03` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33765201816) |
| 2026-09-03T14:14:16Z | 33765662600 | `2e76b8688a5ab4b817c088368977721063a7f56b` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33765662600) |
| 2026-09-03T14:20:32Z | 33766273920 | `9e01d5780e02538f0664a8fc6daa08d0249f2e1c` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33766273920) |
| 2026-09-03T15:50:24Z | 33775017996 | `e03a364db5f69b626b2a10d317a919496f99d2cc` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33775017996) |
| 2026-09-03T16:05:08Z | 33776495956 | `351325203e71b75bc68867f0bde92a3989420aac` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33776495956) |
| 2026-09-03T16:16:12Z | 33777607549 | `c7ac97eebe0027bae3a7c663f69f84cd2e11603b` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33777607549) |
| 2026-09-03T16:46:26Z | 33780629356 | `df67a96df84df33bd082dd0591be907a69e8ccb5` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33780629356) |
| 2026-09-03T17:03:03Z | 33782251912 | `7687947c144bfe9995e66097bbb16ee269e05094` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33782251912) |
| 2026-09-03T19:02:04Z | 33794034673 | `6c880ddcac131de26fad6e56b7a2554fec2eef08` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33794034673) |
| 2026-09-03T19:21:40Z | 33795973185 | `36f9ebf8cd2d4339b22cd178a92aef66bab77d3d` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33795973185) |
| 2026-09-03T19:42:26Z | 33798001793 | `1e5887b8db8acbbdf67c81a9176eb65c3249b51d` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33798001793) |
| 2026-09-03T19:55:36Z | 33799261034 | `a57eb8f1844a4e9df55971448ded9ef0fd3cda8a` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33799261034) |
| 2026-09-03T21:03:46Z | 33805852064 | `c937a9df931102bbcfc94ccaea2e00d87b972297` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33805852064) |
| 2026-09-03T21:09:21Z | 33806376535 | `845cdb344f210e57053fac923f8679a77936a22c` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33806376535) |
| 2026-09-03T21:37:03Z | 33808902037 | `c0b92ae1a130f895bb4465762ef510242e407fa3` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33808902037) |
| 2026-09-04T03:03:45Z | 33831810220 | `a633817673b39e89d100a078e4ae593cc8491cb0` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33831810220) |
| 2026-09-04T03:15:50Z | 33832565674 | `8e49f02f7a2e990abcb1736e4f67bd272e07344f` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33832565674) |
| 2026-09-04T03:51:05Z | 33834691953 | `1f5f164b6819bd8f2cb95f7803fda96cbb455b4f` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33834691953) |
| 2026-09-04T10:49:31Z | 33865045507 | `c981f8ee3fb625f366e3f70077772147b8f3e0f7` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33865045507) |
| 2026-09-04T11:23:50Z | 33867746847 | `c27195f145d10b173de4a940d41154ebb41f1e2c` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33867746847) |
| 2026-09-04T15:02:03Z | 33887151977 | `dbaf29a5b0f01ffd5b922fb40190556cfc1512c9` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33887151977) |
| 2026-09-04T15:11:37Z | 33888064316 | `089ddb0c0a75445544ffd8e0fcd02702dc48c7ea` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33888064316) |
| 2026-09-04T15:21:12Z | 33888982527 | `7e3cd04608d2bfc62d64979c34d81e18ab8a1c26` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33888982527) |
| 2026-09-04T16:29:57Z | 33895471342 | `8a0c145a90be38c52d8e3775bf252da9be257b28` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33895471342) |
| 2026-09-04T16:46:23Z | 33896987984 | `c8c40dbc71906cda4bd77f743364d16c8f465000` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33896987984) |
| 2026-09-04T17:03:13Z | 33898492364 | `a2584688844f1aad55fa471f3cb265c498fecfe1` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33898492364) |
| 2026-09-04T17:41:30Z | 33901918226 | `ceeaae9707c2465dbc1c226d022969b58b2168b8` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33901918226) |
| 2026-09-04T20:37:59Z | 33917191977 | `ce1e22eddfe7ef0336c13a5f74f118d3a1240b88` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33917191977) |
| 2026-09-04T21:00:36Z | 33919035383 | `0a200a62f46b2aa7096c0f40dc86b2c4b42f2f81` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33919035383) |
| 2026-09-05T10:07:29Z | 33959803734 | `111004b8ff5f7176b4abef3bff688a3d8d69de5b` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33959803734) |
| 2026-09-05T10:38:57Z | 33961224989 | `7a9d52361e18c2958582a1f94da98adde89f55a4` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33961224989) |
| 2026-09-05T11:39:32Z | 33963923322 | `48223862bc0f54f35ecf9c254a2a3e3c9e6dc936` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33963923322) |
| 2026-09-05T11:53:33Z | 33964534480 | `cf3e4a6fd9ff96446bc813804660e716dee72d9e` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33964534480) |
| 2026-09-05T12:18:08Z | 33965649794 | `f4361579fd682ceb96a1a741523d00024ee01072` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33965649794) |
| 2026-09-05T12:25:34Z | 33965997595 | `8da862f570c63c9bcf03230f9176c7d0a56985f2` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33965997595) |
| 2026-09-05T12:33:29Z | 33966376993 | `b5b2ca7e975e8bb6ef62a2e426b42375a34a69f3` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33966376993) |
| 2026-09-05T12:36:10Z | 33966507888 | `faef7c267ed6fad25a1040b6a4c861af28dbe4ea` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33966507888) |
| 2026-09-05T12:40:14Z | 33966693497 | `728080c274b152f216db64941f65f4a36dcf16eb` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33966693497) |
| 2026-09-05T15:20:55Z | 33974521683 | `c35a8e5459044ab5a00df74cb4e50d6c3c186e13` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33974521683) |
| 2026-09-05T15:30:01Z | 33974977627 | `c6a6e711ae27302d142703acc5babfaec3b99caa` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33974977627) |
| 2026-09-05T15:35:42Z | 33975279907 | `547c59bddbd3c6736f15edbbac376fed3dd317e9` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33975279907) |
| 2026-09-05T15:45:15Z | 33975752610 | `2177db02c8655ba870cece7c0c0912a4f637453a` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33975752610) |
| 2026-09-05T15:51:33Z | 33976070486 | `c7b6dc81e2e4bd50a362ac25c4681b0888b008d1` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33976070486) |
| 2026-09-05T15:55:40Z | 33976276832 | `83a8e2418be1479f6406108e48f63f8c15f5c7e0` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33976276832) |
| 2026-09-05T16:03:02Z | 33976647608 | `914d835d32d94c208aba5c2e681d110d493a9037` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33976647608) |
| 2026-09-05T16:12:20Z | 33977131390 | `479b9848705ddc528d9e11edbfd7a131c091d2d0` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33977131390) |
| 2026-09-05T19:59:18Z | 33988735288 | `0229f30960e2843468c94227181290b5b388804d` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33988735288) |
| 2026-09-05T20:12:56Z | 33989427696 | `384ecf7b225ddadc61fbbb6a74330716eaf4d7f6` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33989427696) |
| 2026-09-05T20:27:27Z | 33990160484 | `df4acd6ca983455f950665a96369bde48e31ff39` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/33990160484) |
| 2026-09-09T03:22:16Z | 34306855366 | `2b22027ceba264ddf5eb7ce1a62733c2a1be4420` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34306855366) |
| 2026-09-09T03:45:43Z | 34308361706 | `4257a3a4c787c62684defd20979ac44e3a48f2c2` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34308361706) |
| 2026-09-09T03:52:27Z | 34308787438 | `a01141cfa97625299a98df7398ad78e291efe0f9` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34308787438) |
| 2026-09-09T03:55:02Z | 34308949199 | `cb4cdb650c53cd6017099c2250ff515229bb2159` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34308949199) |
| 2026-09-09T13:06:42Z | 34355026680 | `79b6ee71a5a1441733d94d5c63e7542142c411e2` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34355026680) |
| 2026-09-09T13:12:56Z | 34355669739 | `dd0b3ddb371d94d574f93a4d2db7d250c1652ca8` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34355669739) |
| 2026-09-09T13:25:50Z | 34357016126 | `2099af1a609636105c2524a7e87de348de312f10` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34357016126) |
| 2026-09-09T22:51:24Z | 34414243309 | `b6a6c0c4c7846be7fa9566ffe00c3b2007fbcb20` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34414243309) |
| 2026-09-09T22:57:20Z | 34414695893 | `4eb7b0d49bf49f9e7907c20248d23541d8a4ec76` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34414695893) |
| 2026-09-09T23:18:35Z | 34416345908 | `49aa32b4ed9fb8c26e89250dc77bc2445a744a72` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34416345908) |
| 2026-09-09T23:23:50Z | 34416744485 | `9800155be4a384b71ad12abdac684ff8cd3b67fb` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34416744485) |
| 2026-09-09T23:35:04Z | 34417575586 | `de6e6470d7c9b249e7d36ed8a9ef6426258433ba` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34417575586) |
| 2026-09-09T23:58:21Z | 34419226676 | `48c0ac3aa774196827546fa93cfa8843014f4173` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34419226676) |
| 2026-09-10T00:04:39Z | 34419695745 | `eedd55b619af061957de9002156d69f37352c9ea` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34419695745) |
| 2026-09-10T00:12:08Z | 34420262378 | `9bf79aaddef0120334f663cfd5e25f7345ce16b1` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34420262378) |
| 2026-09-10T00:17:39Z | 34420672567 | `b7e0c823c5018cb1112bb65397f66b53900e2e99` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34420672567) |
| 2026-09-10T00:25:37Z | 34421241008 | `ee2381fd02a1b63161a4b84426f972bc05c54730` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34421241008) |
| 2026-09-10T00:35:35Z | 34421947965 | `0f68d10be809038df9cf2488083e45d2381e0dd2` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34421947965) |
| 2026-09-10T00:42:58Z | 34422458824 | `f0ea81a9bc5eb276710e3d5c928f21bbd2dd56fd` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34422458824) |
| 2026-09-10T00:57:29Z | 34423479744 | `ddbc664ab7a7890f33c82980ad214ec33a4ded88` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34423479744) |
| 2026-09-10T01:05:01Z | 34424013681 | `66ab01c05785a46daa013a798d8c92ae03b847e3` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34424013681) |
| 2026-09-10T01:13:50Z | 34424624227 | `8b543b1816a785b3c2120d148c728af841cc31b6` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34424624227) |
| 2026-09-10T01:18:45Z | 34424957833 | `fe637a53ff2745dedd0dda395fe4dc525477d055` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34424957833) |
| 2026-09-10T01:26:18Z | 34425470833 | `3967724f58c541f5cfd5bde39337304a9800af96` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34425470833) |
| 2026-09-10T01:32:21Z | 34425877675 | `3080547437b759dc3440e1645b1d29c00d34e146` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34425877675) |
| 2026-09-10T01:56:51Z | 34427487416 | `3116a8a38cb1c99b0cd440ba7c4a93179ee78f21` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34427487416) |
| 2026-09-10T02:33:15Z | 34429900984 | `cdb553a389523e14bb91bac91f2bf0489aad7cc2` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34429900984) |
| 2026-09-10T02:45:38Z | 34430698124 | `f22d2cbd7438b770356c68d97ee58e9d3169dd44` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34430698124) |
| 2026-09-10T02:51:19Z | 34431059844 | `16059d790301f9d2e5685b4ddf83d7fe3739894b` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34431059844) |
| 2026-09-10T02:56:47Z | 34431408871 | `42260911f41442981a0a45818a151fa9f9c7525a` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34431408871) |
| 2026-09-10T03:00:15Z | 34431624149 | `9f6760f3c3f9dc727b217cdee8d0040d840d59d6` | OTA | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34431624149) |
| 2026-09-10T03:23:09Z | 34433121935 | `e56924784e5144b00b4a70e436095371cad71c6a` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34433121935) |
| 2026-09-10T03:31:44Z | 34433670486 | `979386e5e4b4c54b05d6c9d1ccad6852fa6f2cf8` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34433670486) |
| 2026-09-10T03:36:05Z | 34433950906 | `1c502c9955dc24a902601a227d0f7d30090cc1cf` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34433950906) |
| 2026-09-10T03:39:30Z | 34434161080 | `d97ee1260de6904c52c12d3fc31ce7853e6b05f0` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34434161080) |
| 2026-09-10T03:43:40Z | 34434428743 | `487125dfd2f07aa20bb6fafc22e6b86b4ffb4946` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34434428743) |
| 2026-09-10T03:48:36Z | 34434742985 | `5a541fad7d8643d9771f32af4485f89834215911` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34434742985) |
| 2026-09-10T04:06:16Z | 34435860402 | `27085fe5bd46a4a2f020d9ef9197f1e265ec1f4f` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34435860402) |
| 2026-09-10T04:06:21Z | 34435865638 | `27085fe5bd46a4a2f020d9ef9197f1e265ec1f4f` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34435865638) |
| 2026-09-10T04:11:38Z | 34436212319 | `a50f92b465824351d03781700d28841e38772081` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34436212319) |
| 2026-09-10T04:20:42Z | 34436817916 | `eaf44ebefd15a6a1f13b57313961b197a570f39d` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34436817916) |
| 2026-09-10T08:43:45Z | 34456730865 | `2431276693a1194c6897b9d6403f8d7e27f10f99` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34456730865) |
| 2026-09-10T08:52:43Z | 34457546917 | `d9250515bb29fdfcaf67e567e13aff9799667501` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34457546917) |
| 2026-09-10T08:58:17Z | 34458047360 | `34f1bb7e9c5a55bcdacef83e5826051cad70ef9c` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34458047360) |
| 2026-09-10T09:07:07Z | 34458861395 | `0284c6fefd6abfc6eb3fed52f25793c444082672` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34458861395) |
| 2026-09-10T09:14:54Z | 34459581514 | `45e6894c27052cac42fd9620121d29be6d637f8a` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34459581514) |
| 2026-09-10T09:21:54Z | 34460222216 | `4d48cd9477327d27b0d3037d10c76a7b0824b485` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34460222216) |
| 2026-09-10T09:48:27Z | 34462672353 | `c1e83b37fbabb84f9052c7eb84b18d519482466c` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34462672353) |
| 2026-09-10T10:06:57Z | 34464338206 | `00f3be16a5c061a86b5f7c7ca7130369d8db6b81` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34464338206) |
| 2026-09-10T10:13:00Z | 34464878587 | `610015c418f7d5863d3f378f043eb7345a1f2e08` | Publish OTA update | [View run](https://github.com/allentackie-ops/uvel/actions/runs/34464878587) |

The inventory contains 130 successful workflow runs and 127 unique source commits.

## Verification

All 127 unique OTA source commits were checked against the local Git object database. Twenty-two historical OTA source commits are present as Git objects but are not ancestors of the current `main` tip, indicating historical branch/lineage divergence. The latest production runtime source is explicitly preserved by building from current `main`, which contains the latest successful production OTA source commit `610015c` and the post-OTA crash fixes.
