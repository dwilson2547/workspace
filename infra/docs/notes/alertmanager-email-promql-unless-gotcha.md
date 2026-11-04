---
title: Alertmanager email + PromQL unless gotcha
date: 2026-10-15
tags: alerting,prometheus,promql,backup
---

Backup-failure alerting lives in monitoring/manifests/postgres-backup-alerts.yaml: PrometheusRule + AlertmanagerConfig routed to Gmail SMTP (secret alertmanager-smtp in ns postgres, copied from scrape-job-manager-smtp). Placement rule: AlertmanagerConfig must sit in the namespace its alerts carry (job metrics carry namespace=postgres) because the operator routes configs by their own namespace, and the prometheusSpec needs alertmanagerConfigSelector + NamespaceSelector {}. PromQL gotcha: set operators like unless match the FULL label set - kube_cronjob_info vs kube_cronjob_status_last_successful_time always differ, so use 'unless on(namespace, cronjob)' or the never-succeeded branch fires always. Verify email delivery with alertmanager_notifications_total{integration='email'}. See: infra/cluster-config/CHANGELOG.md
