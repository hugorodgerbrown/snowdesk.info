# Snowdesk — Avalanche Bulletin Service

A public service that summarises daily avalanche bulletins to provide
an "at a glance" snapshot of the conditions in a specific region.

## Background

This service is focussed on advanced to expert snowsports enthusiasts (skiers,
snowboarders, split-boarders, ski tourers, ski mountaineers). Anyone who ventures into avalanche terrain, whether that be side-country (lift-accessed) or backcountry (accessed via touring) should be aware of the dangers that avalanches pose. They are unpredictable, and they kill people, every year.

Everyone who ventures off-piste in the Alps is responsible for their own safety, and by extension for the safety of others in their group. Anyone who gets caught up in an avalanche is reliant on those around them to know how to locate and rescue them. If you're in the backcountry that means you. There are no passengers.

The only guaranteed way to avoid being killed in an avalanche is not to get caught in one in the first place, and so some background knowledge of how they form, how they trigger, the different types of avalanches and how snowpacks form and evolve through the winter is essential. Part of this involves reading the avalanche bulletins that each country produces on a daily basis. Anyone planning a backcountry trip _should_ read these. Unfortunately they can be hard to interpret, and hard to summarise.

This service has been created to bridge the gap between doing nothing and reading the bulletins yourself every day. **It is NOT a replacement for reading the full bulletin**, which is our recommendation. We would still recommend reading them daily, and provide a link to the source bulletins alongside each summary.

### SLF Avalanche Bulletins

The current implementation of the service includes Swiss bulletins only - produced by [] (SLF). These bulletins are published daily at 19:00 CET and are valid for 24hrs; during the winter months a second bulletin is published at 0700 CET the following morning with a conditions update.

The format of the bulletin is CAAFML (link), which is a GeoJSON format. [EAWS].

Each daily bulletin contains the forecast for the whole of Switzerland, split into zones (A to H), which are then subdivided into regions. There are 38 regions across all zones. Regions have a common name (e.g. "Verbier") and an identifier ("CH-4115").

### Summary creation

The bulletins contain a mix of structured data and free text comment, which covers the current weather, the forecast, avalanche conditions, recommendations, and more. All of this data is fed to Claude.ai, which provides a more user-friendly summary.
