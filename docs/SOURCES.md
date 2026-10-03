# Scope and sources

Research was supplied in the build brief dated 2026-10-03. The implementation follows a deliberate small-rig planning model, not a manufacturer profile, hardware interface or controller import format.

## Domain references

- ETC, DMX glossary: 512 channels, start address and footprint, with both fixture and controller configuration: https://www.etcconnect.com/WebDocs/Apps/MosaicRecordApp/Content/DMX%20Record%20Help/C-Reference/3.1.0-DMXGlossary.htm
- MA, fixture change and footprint collision/cue concerns: https://help.malighting.com/dot2/en/help/key_ht_addandpatchfixtures.html
- MA, fixture anatomy and separate DMX breaks (deliberately unsupported here): https://help.malighting.com/grandMA2/en/help/key_adv_fixture_anatomy.html
- QLC+, cross-universe RGB-panel addressing (deliberately unsupported here): https://docs.qlcplus.org/v4/fixture-manager/add-rgb-panel

## Existing products

- QLC+ fixture browser and universe view already provide next-free placement, footprints, gaps and occupancy: https://docs.qlcplus.org/v5/fixtures-and-functions/fixture-browser and https://docs.qlcplus.org/v5/fixtures-and-functions/universe-view
- grandMA3 has next-free address/universe, skip-patched and offsets: https://help.malighting.com/grandMA3/2.4/HTML/patch_add_fixtures.html
- StarlightTools provides sequential multi-group patches and CSV: https://starlighttools.org/studio/dmx-address-calculator
- Y-Link provides overlap checks, next-free placement and patch sheets: https://www.y-link.no/en/tools/dmx-address-planner and https://www.y-link.no/en/tools/dmx-patch-sheet

The scope difference considered here is a baseline-to-desired minimum-address-change workflow with hard locks/reservations, explicit bounded-search proof status, and a change kit. This is an implementation/product-scope observation about the reviewed pages, not a claim that no console or other product can do it. No customer interviews, demand validation, patent search or novelty conclusion was performed.
